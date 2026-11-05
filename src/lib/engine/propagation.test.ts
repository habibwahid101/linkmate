import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  attachExternalMember,
  createIdsForPurchase,
  processNewId,
  reconcileGenerationAncestry,
} from "./process.ts";
import { planPackagePlacement } from "./placement.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let lastPg: PGlite | undefined;
type Sql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
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
  await pg.exec(readFileSync(join(ROOT, "migrations/0010_id_based_engine.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0012_sponsor_designations.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0013_placement_cutover_prep.sql"), "utf8"));
  return wrap(pg);
}
async function insertUser(sql: Sql, userId: string, name: string) {
  await sql`insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${userId + "@lm.test"}, 'member', ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).padEnd(6, "X")}, false)`;
}
async function gens(sql: Sql, beneficiaryId: string) {
  const rows = await sql<{ generation: number; n: number }>`
    select generation, count(*)::int as n from generation_memberships
    where beneficiary_id = ${beneficiaryId} group by generation order by generation`;
  return Object.fromEntries(rows.map((r) => [r.generation, r.n]));
}
async function directs(sql: Sql, sponsorId: string) {
  const rows = await sql<{ n: number }>`select count(*)::int as n from sponsor_relationships where sponsor_id = ${sponsorId}`;
  return rows[0]!.n;
}
async function progress(sql: Sql, memberId: string, level: number) {
  const rows = await sql<{
    completed_members: number;
    remaining_members: number;
    accumulated_commission: number;
    status: string;
  }>`select completed_members, remaining_members, accumulated_commission, status
     from level_progress where member_id = ${memberId} and level = ${level}`;
  return rows[0]!;
}
async function comms(sql: Sql, beneficiaryId: string) {
  return sql<{ generation: number; level: number; n: number; amt: number; statuses: string[] }>`
    select generation, level, count(*)::int as n, coalesce(sum(commission_amount),0)::int as amt,
           array_agg(status) as statuses
    from commission_entries where beneficiary_id = ${beneficiaryId}
    group by generation, level order by generation`;
}
async function wallet(sql: Sql, memberId: string) {
  const w = await sql<{ available_balance: number }>`select available_balance from wallets where member_id = ${memberId}`;
  const h = await sql<{ held: number }>`select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${memberId}`;
  return { available: Number(w[0]?.available_balance ?? 0), held: Number(h[0]?.held ?? 0) };
}

test("builder: X Gen1 = 1, L1 1/2, 990 HELD", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  await createIdsForPurchase(sql, { userId: "u-y", packageId: "builder", purchaseId: "p-y", externalSponsorId: x.rootId });
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1 });
  assert.equal(await directs(sql, x.rootId), 1);
  const l1 = await progress(sql, x.rootId, 1);
  assert.equal(l1.completed_members, 1);
  assert.equal(l1.status, "IN_PROGRESS");
  assert.equal(Number(l1.accumulated_commission), 990);
  const c = await comms(sql, x.rootId);
  assert.equal(c.length, 1);
  assert.equal(c[0]!.generation, 1);
  assert.equal(Number(c[0]!.amt), 990);
  assert.ok((c[0]!.statuses as string[]).every((s) => s === "HELD"));
});

test("turbo: sponsor is paid on the level where each ID sits; buyer L1 released", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 2, 3: 1 });
  assert.deepEqual(await gens(sql, y.rootId), { 1: 2, 2: 1 });
  assert.equal(await directs(sql, x.rootId), 1);
  assert.equal(await directs(sql, y.rootId), 2);
  const xl1 = await progress(sql, x.rootId, 1);
  const xl2 = await progress(sql, x.rootId, 2);
  assert.equal(xl1.completed_members, 1);
  assert.equal(Number(xl1.accumulated_commission), 990);
  assert.equal(xl2.completed_members, 2);
  assert.equal(xl1.status, "IN_PROGRESS");
  assert.equal(xl2.status, "IN_PROGRESS");
  const yl1 = await progress(sql, y.rootId, 1);
  assert.equal(yl1.status, "RELEASED");
  assert.equal(Number(yl1.accumulated_commission), 1980);
  assert.equal((await wallet(sql, y.rootId)).available, 1980);
  assert.equal((await wallet(sql, y.rootId)).held, 880);
  const xc = await comms(sql, x.rootId);
  assert.equal(xc.length, 3);
  assert.equal(xc[0]!.level, 1);
  assert.equal(Number(xc[0]!.amt), 990);
});

test("super turbo: Y completes L1+L2 and holds 6 of L3; sponsor X is paid by generation", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "super_turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  assert.equal(y.ids.length, 13);
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 2, 3: 4, 4: 6 });
  assert.deepEqual(await gens(sql, y.rootId), { 1: 2, 2: 4, 3: 6 });
  assert.equal(await directs(sql, x.rootId), 1);
  const xl1 = await progress(sql, x.rootId, 1);
  assert.equal(xl1.completed_members, 1);
  assert.equal(Number(xl1.accumulated_commission), 990);
  assert.equal((await progress(sql, y.rootId, 1)).status, "RELEASED");
  assert.equal((await progress(sql, y.rootId, 2)).status, "RELEASED");
  assert.equal((await progress(sql, y.rootId, 3)).completed_members, 6);
  assert.equal((await progress(sql, y.rootId, 3)).status, "IN_PROGRESS");
  assert.equal((await wallet(sql, y.rootId)).available, 1980 + 3520);
  assert.equal((await wallet(sql, y.rootId)).held, 4620);
});

test("hyper turbo: Y releases L1+L2+L3 and holds 7 of L4", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "hyper_turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  assert.equal(y.ids.length, 22);
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 2, 3: 4, 4: 8, 5: 7 });
  assert.deepEqual(await gens(sql, y.rootId), { 1: 2, 2: 4, 3: 8, 4: 7 });
  assert.equal(await directs(sql, x.rootId), 1);
  assert.equal((await sql<{ sponsor_id: string }>`select sponsor_id from member_ids where id = ${y.ids[11]}`)[0]!.sponsor_id, y.ids[5]);
  assert.equal((await sql<{ sponsor_id: string }>`select sponsor_id from member_ids where id = ${y.ids[17]}`)[0]!.sponsor_id, y.ids[8]);
  const xl1 = await progress(sql, x.rootId, 1);
  assert.equal(xl1.completed_members, 1);
  assert.equal(Number(xl1.accumulated_commission), 990);
  const yl3 = await progress(sql, y.rootId, 3);
  assert.equal(yl3.completed_members, 8);
  assert.equal(yl3.status, "RELEASED");
  const yl4 = await progress(sql, y.rootId, 4);
  assert.equal(yl4.completed_members, 7);
  assert.equal(yl4.status, "IN_PROGRESS");
  const yw = await wallet(sql, y.rootId);
  assert.equal(yw.available, 1980 + 3520 + 6160);
  assert.equal(yw.held, 4620);
});

test("deep mixed-package ancestry continues by sponsor distance", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  await insertUser(sql, "u-z", "Z");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  const internal = y.ids[1]!;
  const z = await createIdsForPurchase(sql, { userId: "u-z", packageId: "turbo", purchaseId: "p-z", externalSponsorId: internal });
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 2, 3: 2, 4: 2, 5: 1 });
  const zRootGen = await sql<{ generation: number }>`
    select generation from generation_memberships where beneficiary_id = ${x.rootId} and member_id = ${z.rootId}`;
  assert.equal(zRootGen[0]!.generation, 3);
  assert.equal(await directs(sql, x.rootId), 1);
  assert.equal(await directs(sql, internal), 2);
});

test("replay does not duplicate memberships or commissions", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "super_turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  const beforeMem = await sql<{ n: number }>`select count(*)::int as n from generation_memberships`;
  const beforeComm = await sql<{ n: number }>`select count(*)::int as n from commission_entries`;
  for (const id of y.ids) await processNewId(sql, id);
  const afterMem = await sql<{ n: number }>`select count(*)::int as n from generation_memberships`;
  const afterComm = await sql<{ n: number }>`select count(*)::int as n from commission_entries`;
  assert.equal(afterMem[0]!.n, beforeMem[0]!.n);
  assert.equal(afterComm[0]!.n, beforeComm[0]!.n);
});

test("placement plan fills each level to its cap of 2", () => {
  const plan = planPackagePlacement("hyper_turbo");
  assert.equal(plan.length, 22);
  assert.deepEqual(plan.filter((p) => p.parentIndex === 0).map((p) => p.index), [1, 2]);
  assert.deepEqual(plan.filter((p) => p.sponsorIndex === 5).map((p) => p.index), [11, 12]);
  assert.deepEqual(plan.filter((p) => p.sponsorIndex === 8).map((p) => p.index), [17, 18]);
  const kids = new Map<number, number>();
  for (const row of plan) {
    if (row.parentIndex == null) continue;
    kids.set(row.parentIndex, (kids.get(row.parentIndex) ?? 0) + 1);
  }
  for (const n of kids.values()) assert.ok(n <= 2);
});

test("reconciliation backfills omitted generation rows without creating retroactive commissions", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  for (const id of y.ids.slice(1)) {
    await sql`delete from generation_memberships where member_id = ${id} and beneficiary_id = ${x.rootId}`;
  }
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1 });

  const dry = await reconcileGenerationAncestry(sql, { dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.ok(dry.missingMemberships >= 3);
  assert.equal(dry.missingCommissions, 0);
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1 });

  const beforeComm = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries where beneficiary_id = ${x.rootId}`;
  const applied = await reconcileGenerationAncestry(sql, { dryRun: false });
  assert.equal(applied.dryRun, false);
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 2, 3: 1 });
  const l2 = await progress(sql, x.rootId, 2);
  assert.equal(l2.completed_members, 2);
  const commCount = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries where beneficiary_id = ${x.rootId}`;
  assert.equal(commCount[0]!.n, beforeComm[0]!.n);
});
