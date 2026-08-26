import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  approvePayment,
  assertPaymentOwner,
  getPaymentRequest,
  listUserPayments,
  markPaymentNeedsReview,
  rejectPayment,
  savePaymentMethod,
  submitPaymentRequest,
  type Sql,
} from "./engine.ts";
import { PACKAGES } from "../rules.ts";
import { assertAdminRole } from "../auth/roles.ts";

function wrap(pg: PGlite): Sql {
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await pg.query<T>(text, values);
    return result.rows;
  }) as Sql;
}

async function makeSql(): Promise<{ sql: Sql; pg: PGlite }> {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(readFileSync("/workspace/migrations/0002_schema.sql", "utf8"));
  await pg.exec(readFileSync("/workspace/migrations/0003_hardening.sql", "utf8"));
  await pg.exec(readFileSync("/workspace/migrations/0005_manual_payments.sql", "utf8"));
  return { sql: wrap(pg), pg };
}

async function insertUser(sql: Sql, userId: string, name: string, role = "member") {
  await sql`
    insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (
      ${userId},
      ${name},
      ${userId + "@lm.test"},
      ${role},
      ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).padEnd(6, "X")},
      false
    )
  `;
}

async function configureMethods(sql: Sql, admin = "admin1") {
  await insertUser(sql, admin, "Admin", "admin");
  await savePaymentMethod(sql, admin, { method: "BKASH", enabled: true, number: "01700000000" });
  await savePaymentMethod(sql, admin, { method: "NAGAD", enabled: true, number: "01700000000" });
  await savePaymentMethod(sql, admin, {
    method: "BANK",
    enabled: true,
    bank_name: "Demo Bank",
    account_name: "Link Mate",
    account_number: "1234567890",
    branch: "Gulshan",
  });
  await savePaymentMethod(sql, admin, { method: "CASH", enabled: true, instructions: "Pay at office." });
}

describe("manual payment engine", () => {
  it("uses locked server-side package amounts for every method", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    for (const method of ["BKASH", "NAGAD", "BANK", "CASH"] as const) {
      const req = await submitPaymentRequest(sql, {
        userId: "u1",
        packageId: "builder",
        method,
        submittedAmountBdt: 11000,
        transactionReference: method === "CASH" ? undefined : `TX-${method}`,
      });
      assert.equal(req.expected_amount_bdt, PACKAGES.builder.amountBdt);
      assert.equal(req.status, "PENDING");
    }
  });

  it("does not activate on submit", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    const req = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "turbo",
      method: "BKASH",
      submittedAmountBdt: 44000,
      transactionReference: "BK123",
    });
    const ids = await sql<{ n: number }>`select count(*)::int as n from member_ids where owner_user_id = ${"u1"}`;
    const commissions = await sql<{ n: number }>`select count(*)::int as n from commission_entries`;
    assert.equal(req.status, "PENDING");
    assert.equal(ids[0]?.n, 0);
    assert.equal(commissions[0]?.n, 0);
  });

  it("flags duplicate transaction references without auto-activating", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    await insertUser(sql, "u2", "Other");
    await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "BKASH",
      submittedAmountBdt: 11000,
      transactionReference: "ABC 111",
    });
    const second = await submitPaymentRequest(sql, {
      userId: "u2",
      packageId: "builder",
      method: "BKASH",
      submittedAmountBdt: 11000,
      transactionReference: "abc111",
    });
    assert.equal(second.duplicate_suspect, true);
    assert.equal(second.status, "PENDING");
  });

  it("approves exactly once and ignores a second approve", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    const req = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "BKASH",
      submittedAmountBdt: 11000,
      transactionReference: "ONCE-1",
    });
    const first = await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
    const second = await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal(first.purchaseId, second.purchaseId);
    assert.equal(first.ids.length, 1);
    const purchases = await sql<{ n: number }>`select count(*)::int as n from package_purchases`;
    assert.equal(purchases[0]?.n, 1);
  });

  it("approval generates turbo IDs and does not leak to an external sponsor", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "sponsor", "Sponsor");
    await insertUser(sql, "buyer", "Buyer");
    const sponsorPay = await submitPaymentRequest(sql, {
      userId: "sponsor",
      packageId: "builder",
      method: "CASH",
      submittedAmountBdt: 11000,
    });
    const sponsor = await approvePayment(sql, { requestId: sponsorPay.id, adminUserId: "admin1" });
    const sponsorUser = await sql<{ referral_code: string }>`select referral_code from app_users where user_id = ${"sponsor"}`;
    const req = await submitPaymentRequest(sql, {
      userId: "buyer",
      packageId: "turbo",
      method: "NAGAD",
      submittedAmountBdt: 44000,
      transactionReference: "NG-99",
      referralCode: sponsorUser[0]!.referral_code,
    });
    const result = await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
    assert.equal(result.ids.length, 4);
    const sponsorRels = await sql<{ sponsor_id: string; sponsored_id: string }>`
      select sponsor_id, sponsored_id from sponsor_relationships where sponsor_id = ${sponsor.rootId}
    `;
    assert.equal(sponsorRels.length, 1);
    assert.equal(sponsorRels[0]?.sponsored_id, result.rootId);
    const commissions = await sql<{ n: number }>`
      select count(*)::int as n from commission_entries where beneficiary_user_id = ${"sponsor"}
    `;
    assert.ok((commissions[0]?.n ?? 0) > 0);
    const held = await sql<{ v: number }>`
      select coalesce(sum(amount),0)::int as v from held_commissions where owner_user_id = ${"sponsor"}
    `;
    assert.ok((held[0]?.v ?? 0) > 0);
  });

  it("rejected and needs-review payments create no IDs or commissions", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    const rejectMe = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "BANK",
      submittedAmountBdt: 11000,
      transactionReference: "BNK-1",
    });
    await rejectPayment(sql, { requestId: rejectMe.id, adminUserId: "admin1", reason: "Transaction not found" });
    const reviewMe = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "BANK",
      submittedAmountBdt: 11000,
      transactionReference: "BNK-2",
    });
    await markPaymentNeedsReview(sql, {
      requestId: reviewMe.id,
      adminUserId: "admin1",
      note: "Amount screenshot unclear",
    });
    const ids = await sql<{ n: number }>`select count(*)::int as n from member_ids`;
    const commissions = await sql<{ n: number }>`select count(*)::int as n from commission_entries`;
    assert.equal(ids[0]?.n, 0);
    assert.equal(commissions[0]?.n, 0);
    const listed = await listUserPayments(sql, "u1");
    assert.equal(listed.length, 2);
    const rejected = await getPaymentRequest(sql, rejectMe.id);
    assert.equal(rejected?.status, "REJECTED");
  });

  it("allows a new request after rejection", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    const first = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "BKASH",
      submittedAmountBdt: 11000,
      transactionReference: "OLD",
    });
    await rejectPayment(sql, { requestId: first.id, adminUserId: "admin1", reason: "Incorrect amount" });
    const second = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "BKASH",
      submittedAmountBdt: 11000,
      transactionReference: "NEW-OK",
    });
    const approved = await approvePayment(sql, { requestId: second.id, adminUserId: "admin1" });
    assert.equal(approved.ids.length, 1);
    assert.equal((await getPaymentRequest(sql, first.id))?.status, "REJECTED");
  });

  it("refuses to approve a duplicate transaction already approved", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    await insertUser(sql, "u2", "Other");
    const a = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "BKASH",
      submittedAmountBdt: 11000,
      transactionReference: "SAME",
    });
    await approvePayment(sql, { requestId: a.id, adminUserId: "admin1" });
    const b = await submitPaymentRequest(sql, {
      userId: "u2",
      packageId: "builder",
      method: "BKASH",
      submittedAmountBdt: 11000,
      transactionReference: "SAME",
    });
    await assert.rejects(
      () => approvePayment(sql, { requestId: b.id, adminUserId: "admin1" }),
      /already approved/,
    );
    const ids = await sql<{ n: number }>`select count(*)::int as n from member_ids`;
    assert.equal(ids[0]?.n, 1);
  });

  it("refuses approve when submitted amount does not match locked price", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    const req = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "CASH",
      submittedAmountBdt: 10000,
    });
    await assert.rejects(
      () => approvePayment(sql, { requestId: req.id, adminUserId: "admin1" }),
      /package price/,
    );
  });

  it("cash approval activates membership", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    const req = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "CASH",
      submittedAmountBdt: 11000,
      extra: { receivedBy: "Desk" },
    });
    const result = await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
    assert.equal(result.ids.length, 1);
    const active = await sql<{ active_id: string | null }>`select active_id from app_users where user_id = ${"u1"}`;
    assert.equal(active[0]?.active_id, result.rootId);
  });

  it("lists only the requesting user's payments", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    await insertUser(sql, "u2", "Other");
    await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "CASH",
      submittedAmountBdt: 11000,
    });
    const mine = await listUserPayments(sql, "u1");
    const theirs = await listUserPayments(sql, "u2");
    assert.equal(mine.length, 1);
    assert.equal(theirs.length, 0);
  });

  it("writes audit rows for submit, review, reject, and approve", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    const req = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "BKASH",
      submittedAmountBdt: 11000,
      transactionReference: "AUD-1",
    });
    await markPaymentNeedsReview(sql, { requestId: req.id, adminUserId: "admin1", note: "Check later" });
    await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
    const logs = await sql<{ action: string }>`
      select action from audit_logs where entity_type = 'payment_requests' order by created_at
    `;
    assert.ok(logs.some((l) => l.action === "payment.submitted"));
    assert.ok(logs.some((l) => l.action === "payment.needs_review"));
    assert.ok(logs.some((l) => l.action === "payment.approved"));
    const notes = await sql<{ title: string }>`
      select title from notifications where user_id = ${"u1"} order by created_at
    `;
    assert.ok(notes.some((n) => n.title === "Payment submitted"));
    assert.ok(notes.some((n) => n.title === "Payment needs review"));
    assert.ok(notes.some((n) => n.title === "Payment approved"));
    assert.ok(notes.some((n) => n.title === "Package activated"));
  });

  it("hyper turbo approval issues 22 IDs with last 9 unplaced", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    const req = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "hyper_turbo",
      method: "BANK",
      submittedAmountBdt: 242000,
      transactionReference: "HT-1",
    });
    const result = await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
    assert.equal(result.ids.length, 22);
    const pending = await sql<{ n: number }>`
      select count(*)::int as n from member_ids
      where purchase_id = ${result.purchaseId} and placement_status = 'pending_config'
    `;
    assert.equal(pending[0]?.n, 9);
  });

  it("refuses a disabled or unconfigured method", async () => {
    const { sql } = await makeSql();
    await configureMethods(sql);
    await insertUser(sql, "u1", "Buyer");
    await savePaymentMethod(sql, "admin1", { method: "BKASH", enabled: false, number: "01700000000" });
    await assert.rejects(
      () =>
        submitPaymentRequest(sql, {
          userId: "u1",
          packageId: "builder",
          method: "BKASH",
          submittedAmountBdt: 11000,
          transactionReference: "OFF",
        }),
      /not available/,
    );
    await savePaymentMethod(sql, "admin1", { method: "NAGAD", enabled: true, number: null });
    await assert.rejects(
      () =>
        submitPaymentRequest(sql, {
          userId: "u1",
          packageId: "builder",
          method: "NAGAD",
          submittedAmountBdt: 11000,
          transactionReference: "NO-NUM",
        }),
      /not configured/,
    );
  });

  it("prevents cross-user access and unauthorized admin actions", () => {
    assert.throws(() => assertAdminRole("member"), /Forbidden/);
    assert.throws(() => assertAdminRole(null), /Forbidden/);
    assert.doesNotThrow(() => assertAdminRole("admin"));
    assert.throws(
      () =>
        assertPaymentOwner(
          {
            id: "p1",
            user_id: "u1",
            package_id: "builder",
            expected_amount_bdt: 11000,
            submitted_amount_bdt: 11000,
            payment_method: "CASH",
            transaction_reference: null,
            transaction_reference_norm: null,
            user_note: null,
            extra: {},
            proof_reference: null,
            duplicate_suspect: false,
            status: "PENDING",
            admin_note: null,
            reviewed_by: null,
            reviewed_at: null,
            purchase_id: null,
            approval_event_id: null,
            referral_code: null,
            created_at: "",
            updated_at: "",
          },
          "u2",
        ),
      /not found/,
    );
  });
});
