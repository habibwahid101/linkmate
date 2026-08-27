import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { createIdsForPurchase, attachExternalMember, reverseJoin, processNewId } from "./process.ts";
import { uid } from "./ids.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

let lastPg: PGlite | undefined;

type Sql = {
  <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
};

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
    try { await lastPg.close(); } catch { /* ignore */ }
    lastPg = undefined;
  }
  const pg = new PGlite();
  lastPg = pg;
  await pg.waitReady;
  await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0003_hardening.sql"), "utf8"));
  return wrap(pg);
}

async function insertUser(sql: Sql, userId: string, name: string) {
  await sql`
    insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${userId + "@lm.test"}, 'member', ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).padEnd(6, "X")}, false)
  `;
}

async function progress(sql: Sql, memberId: string, level: number) {
  const rows = await sql<{
    completed_members: number;
    remaining_members: number;
    accumulated_commission: number;
    status: string;
  }>`
    select completed_members, remaining_members, accumulated_commission, status
    from level_progress where member_id = ${memberId} and level = ${level}
  `;
  return rows[0]!;
}

async function wallet(sql: Sql, memberId: string) {
  const w = await sql<{ available_balance: number; total_released: number }>`
    select available_balance, total_released from wallets where member_id = ${memberId}
  `;
  const h = await sql<{ held: number }>`
    select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${memberId}
  `;
  return {
    available: Number(w[0]?.available_balance ?? 0),
    released: Number(w[0]?.total_released ?? 0),
    held: Number(h[0]?.held ?? 0),
  };
}

async function commissionsFrom(sql: Sql, beneficiaryId: string) {
  return sql<{
    source_id: string;
    generation: number;
    level: number;
    commission_amount: number;
    status: string;
  }>`
    select source_id, generation, level, commission_amount, status
    from commission_entries where beneficiary_id = ${beneficiaryId}
    order by generation, source_id
  `;
}

test("builder creates 1 ID and no self-commission", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-builder", "Builder");
  const created = await createIdsForPurchase(sql, {
    userId: "u-builder",
    packageId: "builder",
    purchaseId: "p-builder",
    externalSponsorId: null,
  });
  assert.equal(created.ids.length, 1);
  const comm = await commissionsFrom(sql, created.rootId);
  assert.equal(comm.length, 0);
  const l1 = await progress(sql, created.rootId, 1);
  assert.equal(l1.completed_members, 0);
  assert.equal(l1.status, "IN_PROGRESS");
});
