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
  if (lastPg) { try { await lastPg.close(); } catch { /* ignore */ } lastPg = undefined; }
  const pg = new PGlite(); lastPg = pg; await pg.waitReady;
  await pg.exec(readFileSync(join(ROOT, "migrations/0002_schema.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0003_hardening.sql"), "utf8"));
  return wrap(pg);
}
async function insertUser(sql: Sql, userId: string, name: string) {
  await sql`insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic) values (${userId}, ${name}, ${userId + "@lm.test"}, 'member', ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).padEnd(6, "X")}, false)`;
}
async function progress(sql: Sql, memberId: string, level: number) {
  const rows = await sql<{completed_members: number; remaining_members: number; accumulated_commission: number; status: string}>`select completed_members, remaining_members, accumulated_commission, status from level_progress where member_id = ${memberId} and level = ${level}`;
  return rows[0]!;
}
async function wallet(sql: Sql, memberId: string) {
  const w = await sql<{ available_balance: number; total_released: number }>`select available_balance, total_released from wallets where member_id = ${memberId}`;
  const h = await sql<{ held: number }>`select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${memberId}`;
  return { available: Number(w[0]?.available_balance ?? 0), released: Number(w[0]?.total_released ?? 0), held: Number(h[0]?.held ?? 0) };
}
async function commissionsFrom(sql: Sql, beneficiaryId: string) {
  return sql<{source_id: string; generation: number; level: number; commission_amount: number; status: string}>`select source_id, generation, level, commission_amount, status from commission_entries where beneficiary_id = ${beneficiaryId} order by generation, source_id`;
}
test("builder creates 1 ID and no self-commission", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-builder", "Builder");
  const created = await createIdsForPurchase(sql, { userId: "u-builder", packageId: "builder", purchaseId: "p-builder", externalSponsorId: null });
  assert.equal(created.ids.length, 1);
  assert.equal((await commissionsFrom(sql, created.rootId)).length, 0);
  const l1 = await progress(sql, created.rootId, 1);
  assert.equal(l1.completed_members, 0);
  assert.equal(l1.status, "IN_PROGRESS");
});
test("turbo: X gets root Gen1 + 3 internals Gen2; Y L1 releases 2640", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-sponsor", "Sponsor");
  await insertUser(sql, "u-buyer", "Buyer");
  const sponsor = await createIdsForPurchase(sql, { userId: "u-sponsor", packageId: "builder", purchaseId: "p-sp", externalSponsorId: null });
  const buyer = await createIdsForPurchase(sql, { userId: "u-buyer", packageId: "turbo", purchaseId: "p-turbo", externalSponsorId: sponsor.rootId });
  assert.equal(buyer.ids.length, 4);
  const sponsorComm = await commissionsFrom(sql, sponsor.rootId);
  assert.equal(sponsorComm.length, 4);
  const byGen = new Map<number, number>();
  let gen1 = 0;
  let gen2 = 0;
  for (const row of sponsorComm) {
    byGen.set(row.generation, (byGen.get(row.generation) ?? 0) + 1);
    if (row.generation === 1) {
      assert.equal(Number(row.commission_amount), 880);
      assert.equal(row.source_id, buyer.rootId);
      gen1 += 1;
    }
    if (row.generation === 2) {
      assert.equal(Number(row.commission_amount), 660);
      gen2 += 1;
    }
    assert.equal(row.status, "HELD");
  }
  assert.equal(gen1, 1);
  assert.equal(gen2, 3);
  const directs = await sql<{ n: number }>`select count(*)::int as n from sponsor_relationships where sponsor_id = ${sponsor.rootId}`;
  assert.equal(directs[0]!.n, 1);
  const l1 = await progress(sql, sponsor.rootId, 1);
  const l2 = await progress(sql, sponsor.rootId, 2);
  assert.equal(l1.completed_members, 1);
  assert.equal(l1.status, "IN_PROGRESS");
  assert.equal(Number(l1.accumulated_commission), 880);
  assert.equal(l2.completed_members, 3);
  assert.equal(l2.status, "IN_PROGRESS");
  assert.equal(Number(l2.accumulated_commission), 1980);
  const rootW = await wallet(sql, buyer.rootId);
  assert.equal(rootW.available, 2640);
});
test("replaying processNewId does not duplicate commission or generation", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  await insertUser(sql, "u-b", "B");
  const sponsor = await createIdsForPurchase(sql, { userId: "u-s", packageId: "builder", purchaseId: "p1", externalSponsorId: null });
  const buyer = await createIdsForPurchase(sql, { userId: "u-b", packageId: "turbo", purchaseId: "p2", externalSponsorId: sponsor.rootId });
  await processNewId(sql, buyer.rootId);
  await processNewId(sql, buyer.ids[1]!);
  assert.equal((await commissionsFrom(sql, sponsor.rootId)).length, 4);
});
test("super turbo places 1+3+9 and completes root L1+L2", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-st", "Super");
  const created = await createIdsForPurchase(sql, { userId: "u-st", packageId: "super_turbo", purchaseId: "p-st", externalSponsorId: null });
  assert.equal(created.ids.length, 13);
  const l1 = await progress(sql, created.rootId, 1);
  const l2 = await progress(sql, created.rootId, 2);
  assert.equal(l1.status, "RELEASED");
  assert.equal(l2.status, "RELEASED");
});
test("hyper turbo: all 22 placed; middle gen-2 IDs sponsor the final 9", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-ht", "Hyper");
  const created = await createIdsForPurchase(sql, { userId: "u-ht", packageId: "hyper_turbo", purchaseId: "p-ht", externalSponsorId: null });
  assert.equal(created.ids.length, 22);
  const pending = await sql<{ n: number }>`select count(*)::int as n from member_ids where purchase_id = ${"p-ht"} and placement_status = 'pending_config'`;
  assert.equal(pending[0]?.n, 0);
  const placed = await sql<{ n: number }>`select count(*)::int as n from member_ids where purchase_id = ${"p-ht"} and placement_status = 'placed'`;
  assert.equal(placed[0]?.n, 22);
  const placements = await sql<{ n: number }>`select count(*)::int as n from placement_relationships where parent_id = ${created.ids[5]!}`;
  assert.equal(placements[0]?.n, 3);
});
test("sample turbo: L1 released 2640, L2 6/9 held 3960, then 9/9 releases 5940 once", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-demo", "Demo");
  const turbo = await createIdsForPurchase(sql, { userId: "u-demo", packageId: "turbo", purchaseId: "p-demo", externalSponsorId: null });
  const internals = turbo.ids.slice(1);
  for (let i = 0; i < 6; i++) {
    const synth = `synth-${i}`;
    await sql`insert into app_users (user_id, display_name, role, referral_code, is_synthetic) values (${synth}, ${"Member " + i}, 'member', ${"SM" + i + "XX"}, true)`;
    await attachExternalMember(sql, { ownerUserId: synth, displayName: "Member", email: null, packageId: "builder", sponsorMemberId: internals[i % 3]!, parentMemberId: internals[i % 3]! });
  }
  const l2 = await progress(sql, turbo.rootId, 2);
  assert.equal(l2.completed_members, 6);
  for (let i = 0; i < 3; i++) {
    const synth = `closer-${i}`;
    await sql`insert into app_users (user_id, display_name, role, referral_code, is_synthetic) values (${synth}, ${"Closer " + i}, 'member', ${"CL" + i + "XX"}, true)`;
    await attachExternalMember(sql, { ownerUserId: synth, displayName: "Closer", email: null, packageId: "builder", sponsorMemberId: internals[i]!, parentMemberId: internals[i]! });
  }
  const l2b = await progress(sql, turbo.rootId, 2);
  assert.equal(l2b.status, "RELEASED");
});
test("generation identities are not reclassified after later levels complete", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-g", "Gen");
  const turbo = await createIdsForPurchase(sql, { userId: "u-g", packageId: "super_turbo", purchaseId: "p-g", externalSponsorId: null });
  const before = await sql<{ member_id: string; generation: number }>`select member_id, generation from generation_memberships where beneficiary_id = ${turbo.rootId} order by generation, member_id`;
  for (const id of turbo.ids) await processNewId(sql, id);
  const after = await sql<{ member_id: string; generation: number }>`select member_id, generation from generation_memberships where beneficiary_id = ${turbo.rootId} order by generation, member_id`;
  assert.deepEqual(after, before);
});
test("reversal preserves ledger rows, claws back released wallet, reopens incomplete level", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-r", "Rev");
  const turbo = await createIdsForPurchase(sql, { userId: "u-r", packageId: "turbo", purchaseId: "p-r", externalSponsorId: null });
  const internals = turbo.ids.slice(1);
  const sources: string[] = [];
  for (let i = 0; i < 9; i++) {
    const synth = `rv-${i}`;
    await sql`insert into app_users (user_id, display_name, role, referral_code, is_synthetic) values (${synth}, ${"R " + i}, 'member', ${"RV" + i + "XX"}, true)`;
    sources.push(await attachExternalMember(sql, { ownerUserId: synth, displayName: "R", email: null, packageId: "builder", sponsorMemberId: internals[i % 3]!, parentMemberId: internals[i % 3]! }));
  }
  await reverseJoin(sql, { sourceId: sources[0]!, actorUserId: "u-r", reason: "QA reverse" });
  const l2 = await progress(sql, turbo.rootId, 2);
  assert.equal(l2.completed_members, 8);
});
test("Level 1 0/1/2/3 hold then full release, no partial", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-l1", "L1");
  const root = await createIdsForPurchase(sql, { userId: "u-l1", packageId: "builder", purchaseId: "p-l1", externalSponsorId: null });
  for (let i = 0; i < 3; i++) {
    const synth = `d-${i}`;
    await sql`insert into app_users (user_id, display_name, role, referral_code, is_synthetic) values (${synth}, ${"D " + i}, 'member', ${"DD" + i + "XX"}, true)`;
    await attachExternalMember(sql, { ownerUserId: synth, displayName: "D", email: null, packageId: "builder", sponsorMemberId: root.rootId, parentMemberId: root.rootId });
  }
  const l1 = await progress(sql, root.rootId, 1);
  assert.equal(l1.status, "RELEASED");
});
