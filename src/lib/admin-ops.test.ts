import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { assertAdminRole } from "./auth/roles.ts";
import { ADMIN_EMPTY, statusVisual } from "./admin-status.ts";
import { evaluateLandQualification } from "./qualification.ts";
import {
  createWithdrawalRequest,
  processWithdrawalRequest,
  type Sql,
} from "./withdrawals/engine.ts";
import { rejectPayment, submitPaymentRequest, savePaymentMethod } from "./payments/engine.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function wrap(pg: PGlite): Sql {
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await pg.query<T>(text, values);
    return result.rows;
  }) as Sql;
}

describe("admin authorization", () => {
  it("rejects a non-admin with Forbidden", () => {
    assert.throws(() => assertAdminRole("member"), /Forbidden/);
    assert.throws(() => assertAdminRole(null), /Forbidden/);
    assert.throws(() => assertAdminRole("operator"), /Forbidden/);
    assert.doesNotThrow(() => assertAdminRole("admin"));
  });
});

describe("admin status system", () => {
  it("distinguishes pending from held by label while both use gold/held tone", () => {
    const pending = statusVisual("PENDING");
    const held = statusVisual("HELD");
    assert.equal(pending.tone, "held");
    assert.equal(held.tone, "held");
    assert.equal(pending.label, "Pending Verification");
    assert.equal(held.label, "Held");
    assert.notEqual(pending.label, held.label);
  });

  it("maps approved/released to sage success, rejected/reversed to rose, available to teal", () => {
    assert.equal(statusVisual("APPROVED").tone, "success");
    assert.equal(statusVisual("RELEASED").tone, "success");
    assert.equal(statusVisual("PAID").tone, "success");
    assert.equal(statusVisual("REJECTED").tone, "danger");
    assert.equal(statusVisual("REVERSED").tone, "danger");
    assert.equal(statusVisual("AVAILABLE").tone, "available");
    assert.notEqual(statusVisual("AVAILABLE").tone, statusVisual("RELEASED").tone);
    assert.equal(statusVisual("NEEDS_REVIEW").tone, "warning");
    assert.equal(statusVisual("QUALIFIED").label, "Qualified");
    assert.equal(statusVisual("Not Yet Qualified").label, "Not Yet Qualified");
  });
});

describe("admin empty states", () => {
  it("has operational empty copy for queues", () => {
    assert.match(ADMIN_EMPTY.payments.body, /never activates/i);
    assert.match(ADMIN_EMPTY.withdrawals.body, /500/);
    assert.match(ADMIN_EMPTY.qualification.body, /not legal transfer/i);
    assert.match(ADMIN_EMPTY.ids.body, /approves/i);
  });
});

describe("admin land qualification copy", () => {
  it("does not treat incomplete IDs as qualified", () => {
    const notYet = evaluateLandQualification({
      hasMembership: true,
      directSponsors: 2,
      completedLevels: 8,
      level9Released: false,
    });
    assert.equal(notYet.qualified, false);
    assert.equal(notYet.status, "Not Yet Qualified");
    const yes = evaluateLandQualification({
      hasMembership: true,
      directSponsors: 3,
      completedLevels: 9,
      level9Released: true,
    });
    assert.equal(yes.qualified, true);
    assert.equal(yes.status, "Qualified");
  });
});

describe("admin withdrawal PAY is irreversible", () => {
  it("replays PAY without a second payout row", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
    await pg.exec(readFileSync(join(ROOT, "migrations/0006_withdrawals.sql"), "utf8"));
    await pg.exec(readFileSync(join(ROOT, "migrations/0007_referral_lock_withdraw_fee.sql"), "utf8"));
    await pg.exec(readFileSync(join(ROOT, "migrations/0008_owner_payout_policy.sql"), "utf8"));
    const sql = wrap(pg);
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('u1', 'Member', 'u1@lm.test', 'member', 'AAAA11', false)
    `;
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('admin', 'Admin', 'admin@lm.test', 'admin', 'ADMIN1', false)
    `;
    await sql`
      insert into member_ids (id, owner_user_id, package_id, is_root, placement_status, joining_amount_bdt)
      values ('LM-100001', 'u1', 'builder', true, 'placed', 11000)
    `;
    await sql`
      insert into wallets (member_id, owner_user_id, available_balance, total_released)
      values ('LM-100001', 'u1', 1000, 1000)
    `;
    const created = await createWithdrawalRequest(sql, {
      userId: "u1",
      memberId: "LM-100001",
      amountBdt: 1000,
      payoutMethod: "bkash",
      payoutAccount: "01700000000",
      payoutName: "Member",
    });
    const first = await processWithdrawalRequest(sql, { adminUserId: "admin", id: created.id, action: "PAY" });
    const second = await processWithdrawalRequest(sql, { adminUserId: "admin", id: created.id, action: "PAY" });
    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    const paid = await sql<{ n: number }>`select count(*)::int as n from wallet_transactions where type = ${"WITHDRAWAL_PAID"}`;
    assert.equal(paid[0]?.n, 1);
    await pg.close();
  });
});

describe("admin payment reject does not create IDs", () => {
  it("leaves member_ids empty after reject", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
    await pg.exec(readFileSync(join(ROOT, "migrations/0003_hardening.sql"), "utf8"));
    await pg.exec(readFileSync(join(ROOT, "migrations/0005_manual_payments.sql"), "utf8"));
    await pg.exec(readFileSync(join(ROOT, "migrations/0010_id_based_engine.sql"), "utf8"));
    const bind = (client: { query: typeof pg.query }): Sql => {
      return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
        let text = strings[0] ?? "";
        for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
        const result = await client.query<T>(text, values as never[]);
        return result.rows;
      }) as Sql;
    };
    const sql = bind(pg) as Sql & { withTransaction: <T>(fn: (tx: Sql) => Promise<T>) => Promise<T> };
    sql.withTransaction = async (fn) =>
      pg.transaction(async (tx) => {
        const inner = bind(tx) as typeof sql;
        inner.withTransaction = async (nested) => nested(inner);
        return fn(inner);
      });
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('admin1', 'Admin', 'admin@lm.test', 'admin', 'ADMIN1', false)
    `;
    await sql`
      insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values ('u1', 'Buyer', 'u1@lm.test', 'member', 'BBBB22', false)
    `;
    await savePaymentMethod(sql, "admin1", { method: "CASH", enabled: true, instructions: "Pay at office." });
    const req = await submitPaymentRequest(sql, {
      userId: "u1",
      packageId: "builder",
      method: "CASH",
      submittedAmountBdt: 11000,
    });
    await rejectPayment(sql, { requestId: req.id, adminUserId: "admin1", reason: "Not received" });
    const ids = await sql<{ n: number }>`select count(*)::int as n from member_ids`;
    assert.equal(ids[0]?.n, 0);
    await pg.close();
  });
});
