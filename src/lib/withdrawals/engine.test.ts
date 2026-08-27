import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { quoteWithdrawal, withdrawalFeeBdt } from "./policy.ts";
import {
  createWithdrawalRequest,
  processWithdrawalRequest,
  type Sql,
} from "./engine.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let lastPg: PGlite | undefined;

function wrap(pg: PGlite): Sql {
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await pg.query<T>(text, values);
    return result.rows;
  }) as Sql;
}

async function makeSql(): Promise<Sql> {
  if (lastPg) {
    try {
      await lastPg.close();
    } catch {
      /* ignore */
    }
    lastPg = undefined;
  }
  const pg = new PGlite();
  lastPg = pg;
  await pg.waitReady;
  await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0006_withdrawals.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0007_referral_lock_withdraw_fee.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0008_owner_payout_policy.sql"), "utf8"));
  return wrap(pg);
}

async function seed(sql: Sql, available = 2000) {
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
    values ('LM-100001', 'u1', ${available}, ${available})
  `;
}

describe("withdrawal fee math", () => {
  it("charges 5% of BDT 1000 as BDT 50 with net 950", () => {
    const q = quoteWithdrawal(1000, { minBdt: 500, feeBps: 500 });
    assert.equal(q.feeBdt, 50);
    assert.equal(q.netBdt, 950);
  });

  it("rounds half-up to nearest BDT", () => {
    assert.equal(withdrawalFeeBdt(555, 500), 28);
    assert.equal(withdrawalFeeBdt(501, 500), 25);
  });
});

describe("withdrawal requests", () => {
  it("rejects BDT 499", async () => {
    const sql = await makeSql();
    await seed(sql);
    await assert.rejects(
      () =>
        createWithdrawalRequest(sql, {
          userId: "u1",
          memberId: "LM-100001",
          amountBdt: 499,
          payoutMethod: "bkash",
          payoutAccount: "01700000000",
          payoutName: "Member",
        }),
      /Minimum withdrawal is 500 BDT/,
    );
    const wallet = await sql<{ available_balance: number }>`select available_balance from wallets where member_id = ${"LM-100001"}`;
    assert.equal(Number(wallet[0]?.available_balance), 2000);
  });

  it("accepts BDT 500 when balance allows and records 5% fee", async () => {
    const sql = await makeSql();
    await seed(sql, 500);
    const created = await createWithdrawalRequest(sql, {
      userId: "u1",
      memberId: "LM-100001",
      amountBdt: 500,
      payoutMethod: "nagad",
      payoutAccount: "01700000000",
      payoutName: "Member",
    });
    assert.equal(created.quote.feeBdt, 25);
    assert.equal(created.quote.netBdt, 475);
    const wallet = await sql<{ available_balance: number }>`select available_balance from wallets where member_id = ${"LM-100001"}`;
    assert.equal(Number(wallet[0]?.available_balance), 0);
    const row = await sql<{ fee_bdt: number; amount_bdt: number }>`select fee_bdt, amount_bdt from withdrawal_requests where id = ${created.id}`;
    assert.equal(Number(row[0]?.fee_bdt), 25);
    assert.equal(Number(row[0]?.amount_bdt), 500);
  });

  it("rejects over-balance requests", async () => {
    const sql = await makeSql();
    await seed(sql, 400);
    await assert.rejects(
      () =>
        createWithdrawalRequest(sql, {
          userId: "u1",
          memberId: "LM-100001",
          amountBdt: 500,
          payoutMethod: "bkash",
          payoutAccount: "01700000000",
          payoutName: "Member",
        }),
      /available released balance/,
    );
  });

  it("blocks a second open request", async () => {
    const sql = await makeSql();
    await seed(sql, 2000);
    await createWithdrawalRequest(sql, {
      userId: "u1",
      memberId: "LM-100001",
      amountBdt: 500,
      payoutMethod: "bkash",
      payoutAccount: "01700000000",
      payoutName: "Member",
    });
    await assert.rejects(
      () =>
        createWithdrawalRequest(sql, {
          userId: "u1",
          memberId: "LM-100001",
          amountBdt: 500,
          payoutMethod: "bkash",
          payoutAccount: "01700000000",
          payoutName: "Member",
        }),
      /already in progress/,
    );
  });

  it("restores reserved available on reject", async () => {
    const sql = await makeSql();
    await seed(sql, 1000);
    const created = await createWithdrawalRequest(sql, {
      userId: "u1",
      memberId: "LM-100001",
      amountBdt: 1000,
      payoutMethod: "bkash",
      payoutAccount: "01700000000",
      payoutName: "Member",
    });
    await processWithdrawalRequest(sql, {
      adminUserId: "admin",
      id: created.id,
      action: "REJECT",
      note: "test reject",
    });
    const wallet = await sql<{ available_balance: number }>`select available_balance from wallets where member_id = ${"LM-100001"}`;
    assert.equal(Number(wallet[0]?.available_balance), 1000);
    const restore = await sql<{ n: number }>`select count(*)::int as n from wallet_transactions where type = ${"WITHDRAWAL_RESTORE"}`;
    assert.equal(restore[0]?.n, 1);
  });

  it("ignores duplicate PAY", async () => {
    const sql = await makeSql();
    await seed(sql, 1000);
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
    const wallet = await sql<{ available_balance: number }>`select available_balance from wallets where member_id = ${"LM-100001"}`;
    assert.equal(Number(wallet[0]?.available_balance), 0);
  });
});
