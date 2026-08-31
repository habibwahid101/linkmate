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

test("builder: X Gen1 = 1, L1 1/3, 880 HELD", async () => {
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
  assert.equal(Number(l1.accumulated_commission), 880);
  const c = await comms(sql, x.rootId);
  assert.equal(c.length, 1);
  assert.equal(c[0]!.generation, 1);
  assert.equal(Number(c[0]!.amt), 880);
  assert.ok((c[0]!.statuses as string[]).every((s) => s === "HELD"));
});

test("turbo: X Gen1=1 Gen2=3; Y L1 released; directs stay root-only", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 3 });
  assert.deepEqual(await gens(sql, y.rootId), { 1: 3 });
  assert.equal(await directs(sql, x.rootId), 1);
  assert.equal(await directs(sql, y.rootId), 3);
  const xl1 = await progress(sql, x.rootId, 1);
  const xl2 = await progress(sql, x.rootId, 2);
  assert.equal(xl1.completed_members, 1);
  assert.equal(Number(xl1.accumulated_commission), 880);
  assert.equal(xl2.completed_members, 3);
  assert.equal(Number(xl2.accumulated_commission), 1980);
  assert.equal(xl1.status, "IN_PROGRESS");
  assert.equal(xl2.status, "IN_PROGRESS");
  const yl1 = await progress(sql, y.rootId, 1);
  assert.equal(yl1.status, "RELEASED");
  assert.equal(Number(yl1.accumulated_commission), 2640);
  assert.equal((await wallet(sql, y.rootId)).available, 2640);
  const xc = await comms(sql, x.rootId);
  assert.equal(Number(xc.find((r) => r.generation === 1)!.amt), 880);
  assert.equal(Number(xc.find((r) => r.generation === 2)!.amt), 1980);
});

test("super turbo: X Gen1+2+3 and Y completes L1+L2", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "super_turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  assert.equal(y.ids.length, 13);
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 3, 3: 9 });
  assert.deepEqual(await gens(sql, y.rootId), { 1: 3, 2: 9 });
  assert.equal(await directs(sql, x.rootId), 1);
  const xl1 = await progress(sql, x.rootId, 1);
  const xl2 = await progress(sql, x.rootId, 2);
  const xl3 = await progress(sql, x.rootId, 3);
  assert.equal(xl1.completed_members, 1);
  assert.equal(xl2.completed_members, 3);
  assert.equal(xl3.completed_members, 9);
  assert.equal(Number(xl1.accumulated_commission), 880);
  assert.equal(Number(xl2.accumulated_commission), 1980);
  assert.equal(Number(xl3.accumulated_commission), 2970);
  assert.equal((await progress(sql, y.rootId, 1)).status, "RELEASED");
  assert.equal((await progress(sql, y.rootId, 2)).status, "RELEASED");
  assert.equal((await wallet(sql, y.rootId)).available, 2640 + 5940);
});

test("hyper turbo: X Gen1–4; Y L1+L2 released, L3 9/27 held 2970", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "hyper_turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  assert.equal(y.ids.length, 22);
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 3, 3: 9, 4: 9 });
  assert.deepEqual(await gens(sql, y.rootId), { 1: 3, 2: 9, 3: 9 });
  assert.equal(await directs(sql, x.rootId), 1);
  assert.equal(y.ids[13] && (await sql<{ sponsor_id: string }>`select sponsor_id from member_ids where id = ${y.ids[13]}`)[0]!.sponsor_id, y.ids[5]);
  assert.equal(y.ids[16] && (await sql<{ sponsor_id: string }>`select sponsor_id from member_ids where id = ${y.ids[16]}`)[0]!.sponsor_id, y.ids[8]);
  assert.equal(y.ids[19] && (await sql<{ sponsor_id: string }>`select sponsor_id from member_ids where id = ${y.ids[19]}`)[0]!.sponsor_id, y.ids[11]);
  const xl4 = await progress(sql, x.rootId, 4);
  assert.equal(xl4.completed_members, 9);
  assert.equal(Number(xl4.accumulated_commission), 1980);
  assert.equal(xl4.status, "IN_PROGRESS");
  const yl3 = await progress(sql, y.rootId, 3);
  assert.equal(yl3.completed_members, 9);
  assert.equal(yl3.status, "IN_PROGRESS");
  assert.equal(Number(yl3.accumulated_commission), 2970);
  const yw = await wallet(sql, y.rootId);
  assert.equal(yw.available, 2640 + 5940);
  assert.equal(yw.held, 2970);
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
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 3, 3: 1, 4: 3 });
  const zRootGen = await sql<{ generation: number }>`
    select generation from generation_memberships where beneficiary_id = ${x.rootId} and member_id = ${z.rootId}`;
  assert.equal(zRootGen[0]!.generation, 3);
  for (const id of z.ids.slice(1)) {
    const g = await sql<{ generation: number }>`
      select generation from generation_memberships where beneficiary_id = ${x.rootId} and member_id = ${id}`;
    assert.equal(g[0]!.generation, 4);
  }
  assert.equal(await directs(sql, x.rootId), 1);
  assert.equal(await directs(sql, internal), 1);
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

test("placement plan for hyper turbo is unchanged 1+3+9+9 via A2/B2/C2", () => {
  const plan = planPackagePlacement("hyper_turbo");
  assert.equal(plan.length, 22);
  assert.deepEqual(plan.filter((p) => p.parentIndex === 0).map((p) => p.index), [1, 2, 3]);
  assert.deepEqual(plan.filter((p) => p.sponsorIndex === 5).map((p) => p.index), [13, 14, 15]);
  assert.deepEqual(plan.filter((p) => p.sponsorIndex === 8).map((p) => p.index), [16, 17, 18]);
  assert.deepEqual(plan.filter((p) => p.sponsorIndex === 11).map((p) => p.index), [19, 20, 21]);
});

test("reconciliation backfills omitted upstream gens and is idempotent", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-x", "X");
  await insertUser(sql, "u-y", "Y");
  const x = await createIdsForPurchase(sql, { userId: "u-x", packageId: "builder", purchaseId: "p-x", externalSponsorId: null });
  const y = await createIdsForPurchase(sql, { userId: "u-y", packageId: "turbo", purchaseId: "p-y", externalSponsorId: x.rootId });
  for (const id of y.ids.slice(1)) {
    await sql`delete from generation_memberships where member_id = ${id} and beneficiary_id = ${x.rootId}`;
    await sql`delete from commission_entries where source_id = ${id} and beneficiary_id = ${x.rootId}`;
  }
  await sql`delete from held_commissions where member_id = ${x.rootId} and level = 2`;
  await sql`update level_progress set completed_members = 0, remaining_members = 9, accumulated_commission = 0, status = 'LOCKED' where member_id = ${x.rootId} and level = 2`;
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1 });

  const dry = await reconcileGenerationAncestry(sql, { dryRun: true });
  assert.equal(dry.dryRun, true);
  assert.ok(dry.missingMemberships >= 3);
  assert.ok(dry.missingCommissions >= 3);
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1 });

  const applied = await reconcileGenerationAncestry(sql, { dryRun: false });
  assert.equal(applied.dryRun, false);
  assert.deepEqual(await gens(sql, x.rootId), { 1: 1, 2: 3 });
  const l2 = await progress(sql, x.rootId, 2);
  assert.equal(l2.completed_members, 3);
  assert.equal(Number(l2.accumulated_commission), 1980);
  assert.equal(l2.status, "IN_PROGRESS");

  const again = await reconcileGenerationAncestry(sql, { dryRun: false });
  assert.equal(again.missingMemberships, 0);
  assert.equal(again.missingCommissions, 0);
  const commCount = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries where beneficiary_id = ${x.rootId}`;
  assert.equal(commCount[0]!.n, 4);
});
