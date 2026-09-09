import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  attachExternalMember,
  createIdsForPurchase,
} from "./process.ts";
import {
  assertAcyclicSponsor,
  processMembershipIdActivation,
  processNewId,
  wouldCreateSponsorCycle,
} from "./activation.ts";
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
  return wrap(pg);
}

async function insertUser(sql: Sql, userId: string, name: string) {
  await sql`insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${userId + "@lm.test"}, 'member', ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).padEnd(6, "X")}, false)`;
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

async function wallet(sql: Sql, memberId: string) {
  const w = await sql<{ available_balance: number; total_released: number }>`
    select available_balance, total_released from wallets where member_id = ${memberId}`;
  const h = await sql<{ held: number }>`
    select coalesce(sum(amount),0)::int as held from held_commissions where member_id = ${memberId}`;
  return {
    available: Number(w[0]?.available_balance ?? 0),
    released: Number(w[0]?.total_released ?? 0),
    held: Number(h[0]?.held ?? 0),
  };
}

async function commissions(sql: Sql, beneficiaryId: string) {
  return sql<{
    source_id: string;
    level: number;
    generation: number;
    commission_amount: number;
    status: string;
    beneficiary_id: string;
    beneficiary_user_id: string;
  }>`
    select source_id, level, generation, commission_amount, status, beneficiary_id, beneficiary_user_id
    from commission_entries where beneficiary_id = ${beneficiaryId}
    order by level, source_id`;
}

async function memberState(sql: Sql, id: string) {
  const rows = await sql<{ current_level: number; progression_status: string; referral_code: string }>`
    select current_level, progression_status, referral_code from member_ids where id = ${id}`;
  return rows[0]!;
}

async function addDirect(sql: Sql, owner: string, sponsorId: string, tag: string) {
  await insertUser(sql, owner, tag);
  return attachExternalMember(sql, {
    ownerUserId: owner,
    displayName: tag,
    email: null,
    packageId: "builder",
    sponsorMemberId: sponsorId,
    parentMemberId: sponsorId,
  });
}

test("A. Level 1 0/3 to 3/3 releases 2640 and opens L2 at 0/9", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  let l1 = await progress(sql, s.rootId, 1);
  assert.equal(l1.completed_members, 0);
  assert.equal(l1.status, "IN_PROGRESS");
  assert.equal((await memberState(sql, s.rootId)).current_level, 1);

  await addDirect(sql, "u-a", s.rootId, "A");
  l1 = await progress(sql, s.rootId, 1);
  assert.equal(l1.completed_members, 1);
  assert.equal(Number(l1.accumulated_commission), 880);
  assert.equal((await wallet(sql, s.rootId)).held, 880);

  await addDirect(sql, "u-b", s.rootId, "B");
  l1 = await progress(sql, s.rootId, 1);
  assert.equal(l1.completed_members, 2);

  await addDirect(sql, "u-c", s.rootId, "C");
  l1 = await progress(sql, s.rootId, 1);
  const l2 = await progress(sql, s.rootId, 2);
  assert.equal(l1.status, "RELEASED");
  assert.equal(Number(l1.accumulated_commission), 2640);
  assert.equal((await wallet(sql, s.rootId)).available, 2640);
  assert.equal((await wallet(sql, s.rootId)).held, 0);
  assert.equal(l2.status, "IN_PROGRESS");
  assert.equal(l2.completed_members, 0);
  assert.equal((await memberState(sql, s.rootId)).current_level, 2);
});

test("B. No retroactive banking of pre-L1 descendants into L2", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  const a = await addDirect(sql, "u-a", s.rootId, "A");
  const early = await addDirect(sql, "u-early", a, "Early");
  await addDirect(sql, "u-b", s.rootId, "B");
  await addDirect(sql, "u-c", s.rootId, "C");
  const l2 = await progress(sql, s.rootId, 2);
  assert.equal(l2.completed_members, 0);
  const earlyComm = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries
    where beneficiary_id = ${s.rootId} and source_id = ${early}`;
  assert.equal(earlyComm[0]!.n, 0);
  await addDirect(sql, "u-late", a, "Late");
  const l2b = await progress(sql, s.rootId, 2);
  assert.equal(l2b.completed_members, 1);
  assert.equal(Number(l2b.accumulated_commission), 660);
});

test("C. Level 2 nine downline events complete and release then open L3 0/27", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  const hub = await addDirect(sql, "u-h", s.rootId, "Hub");
  await addDirect(sql, "u-b", s.rootId, "B");
  await addDirect(sql, "u-c", s.rootId, "C");
  assert.equal((await progress(sql, s.rootId, 1)).status, "RELEASED");
  assert.equal((await progress(sql, s.rootId, 2)).completed_members, 0);
  for (let i = 0; i < 9; i++) {
    await addDirect(sql, `u-l2-${i}`, hub, `L2-${i}`);
    const l2 = await progress(sql, s.rootId, 2);
    assert.equal(l2.completed_members, i + 1);
  }
  const l2 = await progress(sql, s.rootId, 2);
  const l3 = await progress(sql, s.rootId, 3);
  assert.equal(l2.status, "RELEASED");
  assert.equal(Number(l2.accumulated_commission), 5940);
  assert.equal((await wallet(sql, s.rootId)).available, 2640 + 5940);
  assert.equal(l3.status, "IN_PROGRESS");
  assert.equal(l3.completed_members, 0);
  assert.equal((await memberState(sql, s.rootId)).current_level, 3);
});

test("D. Generation depth is irrelevant for L2–L9", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  let cursor = s.rootId;
  const chain: string[] = [];
  for (let d = 1; d <= 8; d++) {
    const id = await addDirect(sql, `u-d${d}`, cursor, `D${d}`);
    chain.push(id);
    cursor = id;
  }
  await addDirect(sql, "u-b", s.rootId, "B");
  await addDirect(sql, "u-c", s.rootId, "C");
  assert.equal((await memberState(sql, s.rootId)).current_level, 2);
  const before = (await progress(sql, s.rootId, 2)).completed_members;
  const deep = await addDirect(sql, "u-deep", chain[7]!, "Deep");
  const l2 = await progress(sql, s.rootId, 2);
  assert.equal(l2.completed_members, before + 1);
  const row = (await commissions(sql, s.rootId)).find((c) => c.source_id === deep);
  assert.equal(row?.level, 2);
  assert.ok((row?.generation ?? 0) >= 8);
});

test("E. Multi-ancestor: one activation counts once per eligible ancestor at their own level", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-a", "A");
  const a = await createIdsForPurchase(sql, {
    userId: "u-a", packageId: "builder", purchaseId: "p-a", externalSponsorId: null,
  });
  const b = await addDirect(sql, "u-b", a.rootId, "B");
  await addDirect(sql, "u-a2", a.rootId, "A2");
  await addDirect(sql, "u-a3", a.rootId, "A3");
  assert.equal((await memberState(sql, a.rootId)).current_level, 2);
  const d = await addDirect(sql, "u-d", b, "D");
  const aComms = await commissions(sql, a.rootId);
  const bComms = await commissions(sql, b);
  const aFromD = aComms.filter((c) => c.source_id === d);
  const bFromD = bComms.filter((c) => c.source_id === d);
  assert.equal(aFromD.length, 1);
  assert.equal(aFromD[0]!.level, 2);
  assert.equal(Number(aFromD[0]!.commission_amount), 660);
  assert.equal(bFromD.length, 1);
  assert.equal(bFromD[0]!.level, 1);
  assert.equal(Number(bFromD[0]!.commission_amount), 880);
  assert.equal((await progress(sql, a.rootId, 2)).completed_members, 1);
  assert.equal((await progress(sql, b, 1)).completed_members, 1);
});

test("F. Completing event does not also count as next-level progress", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  const hub = await addDirect(sql, "u-h", s.rootId, "Hub");
  await addDirect(sql, "u-b", s.rootId, "B");
  await addDirect(sql, "u-c", s.rootId, "C");
  for (let i = 0; i < 8; i++) await addDirect(sql, `u-n${i}`, hub, `N${i}`);
  assert.equal((await progress(sql, s.rootId, 2)).completed_members, 8);
  const ninth = await addDirect(sql, "u-nine", hub, "Nine");
  const l2 = await progress(sql, s.rootId, 2);
  const l3 = await progress(sql, s.rootId, 3);
  assert.equal(l2.status, "RELEASED");
  assert.equal(l3.completed_members, 0);
  const ninthRows = (await commissions(sql, s.rootId)).filter((c) => c.source_id === ninth);
  assert.equal(ninthRows.length, 1);
  assert.equal(ninthRows[0]!.level, 2);
});

test("G. Replay does not duplicate progress, commission, held, or wallet", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  const child = await addDirect(sql, "u-a", s.rootId, "A");
  const beforeComm = await sql<{ n: number }>`select count(*)::int as n from commission_entries`;
  const beforeImpact = await sql<{ n: number }>`select count(*)::int as n from membership_activation_impacts`;
  const beforeWallet = await wallet(sql, s.rootId);
  await processNewId(sql, child);
  await processMembershipIdActivation(sql, child);
  const afterComm = await sql<{ n: number }>`select count(*)::int as n from commission_entries`;
  const afterImpact = await sql<{ n: number }>`select count(*)::int as n from membership_activation_impacts`;
  assert.equal(afterComm[0]!.n, beforeComm[0]!.n);
  assert.equal(afterImpact[0]!.n, beforeImpact[0]!.n);
  assert.equal((await progress(sql, s.rootId, 1)).completed_members, 1);
  assert.deepEqual(await wallet(sql, s.rootId), beforeWallet);
});

test("H. Sponsor cycles are rejected", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  const child = await addDirect(sql, "u-a", s.rootId, "A");
  assert.equal(await wouldCreateSponsorCycle(sql, s.rootId, child), true);
  await assert.rejects(() => assertAcyclicSponsor(sql, s.rootId, child), /cycle/i);
  await assert.rejects(() => assertAcyclicSponsor(sql, child, child), /cycle/i);
});

test("I. Same owner / multiple IDs count as independent nodes", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-one", "One");
  const turbo = await createIdsForPurchase(sql, {
    userId: "u-one", packageId: "turbo", purchaseId: "p-t", externalSponsorId: null,
  });
  const owners = await sql<{ n: number }>`
    select count(distinct owner_user_id)::int as n from member_ids where owner_user_id = ${"u-one"}`;
  assert.equal(owners[0]!.n, 1);
  const l1 = await progress(sql, turbo.rootId, 1);
  assert.equal(l1.status, "RELEASED");
  assert.equal(l1.completed_members, 3);
  const comms = await commissions(sql, turbo.rootId);
  assert.equal(comms.length, 3);
  assert.ok(comms.every((c) => c.beneficiary_id === turbo.rootId));
});

test("J. Graduation after L9 is terminal", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  const hub = await addDirect(sql, "u-h", s.rootId, "Hub");
  await addDirect(sql, "u-b", s.rootId, "B");
  await addDirect(sql, "u-c", s.rootId, "C");
  await sql`
    update level_progress
    set status = 'RELEASED', completed_members = required_members, remaining_members = 0,
        completed_at = now(), released_at = now()
    where member_id = ${s.rootId} and level between 1 and 8
  `;
  await sql`
    update member_ids set current_level = 9, progression_status = 'ACTIVE' where id = ${s.rootId}
  `;
  await sql`
    update level_progress
    set status = 'IN_PROGRESS', completed_members = 0, remaining_members = required_members
    where member_id = ${s.rootId} and level = 9
  `;
  for (let i = 0; i < 324; i++) {
    const id = `LM-G${String(i).padStart(4, "0")}`;
    const owner = `og-${i}`;
    await sql`insert into app_users (user_id, display_name, role, referral_code, is_synthetic)
      values (${owner}, ${"G" + i}, 'member', ${"G" + String(i).padStart(4, "0")}, true)`;
    await sql`
      insert into member_ids (
        id, owner_user_id, package_id, is_root, sponsor_id, parent_id, placement_status, status,
        joining_amount_bdt, referral_code, current_level, progression_status, activated_at, origin_kind
      ) values (
        ${id}, ${owner}, 'builder', true, ${hub}, ${hub}, 'placed', 'active', 11000,
        ${"RG" + String(i).padStart(4, "0")}, 1, 'ACTIVE', now(), 'attach'
      )`;
    await sql`insert into wallets (member_id, owner_user_id, available_balance, total_released)
      values (${id}, ${owner}, 0, 0)`;
    await sql`insert into sponsor_relationships (id, sponsor_id, sponsored_id)
      values (${uid()}, ${hub}, ${id})`;
    await processNewId(sql, id);
  }
  const l9 = await progress(sql, s.rootId, 9);
  const state = await memberState(sql, s.rootId);
  assert.equal(l9.status, "RELEASED");
  assert.equal(state.progression_status, "GRADUATED");
  assert.equal(state.current_level, 9);
  const before = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries where beneficiary_id = ${s.rootId} and level = 9`;
  const extraId = "LM-GAFTER";
  await sql`insert into app_users (user_id, display_name, role, referral_code, is_synthetic)
    values ('og-after', 'After', 'member', 'GAFTER', true)`;
  await sql`
    insert into member_ids (
      id, owner_user_id, package_id, is_root, sponsor_id, parent_id, placement_status, status,
      joining_amount_bdt, referral_code, current_level, progression_status, activated_at, origin_kind
    ) values (
      ${extraId}, 'og-after', 'builder', true, ${hub}, ${hub}, 'placed', 'active', 11000,
      'RGAFTR', 1, 'ACTIVE', now(), 'attach'
    )`;
  await sql`insert into wallets (member_id, owner_user_id, available_balance, total_released)
    values (${extraId}, 'og-after', 0, 0)`;
  await sql`insert into sponsor_relationships (id, sponsor_id, sponsored_id)
    values (${uid()}, ${hub}, ${extraId})`;
  await processNewId(sql, extraId);
  const after = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries where beneficiary_id = ${s.rootId} and level = 9`;
  assert.equal(after[0]!.n, before[0]!.n);
  const l10 = await sql<{ n: number }>`
    select count(*)::int as n from level_progress where member_id = ${s.rootId} and level = 10`;
  assert.equal(l10[0]!.n, 0);
});

test("K. Financial traceability on every commission row", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  const s = await createIdsForPurchase(sql, {
    userId: "u-s", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  const child = await addDirect(sql, "u-a", s.rootId, "A");
  const rows = await commissions(sql, s.rootId);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.source_id, child);
  assert.equal(rows[0]!.beneficiary_id, s.rootId);
  assert.equal(rows[0]!.beneficiary_user_id, "u-s");
  assert.equal(rows[0]!.level, 1);
  assert.equal(rows[0]!.status, "HELD");
  assert.equal(Number(rows[0]!.commission_amount), 880);
});

test("L. Mid-processing failure then retry yields one correct result", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-a", "A");
  const a = await createIdsForPurchase(sql, {
    userId: "u-a", packageId: "builder", purchaseId: "p-a", externalSponsorId: null,
  });
  const b = await addDirect(sql, "u-b", a.rootId, "B");
  await addDirect(sql, "u-a2", a.rootId, "A2");
  await addDirect(sql, "u-a3", a.rootId, "A3");
  assert.equal((await memberState(sql, a.rootId)).current_level, 2);

  const childId = "LM-FAIL1";
  await insertUser(sql, "u-e", "E");
  await sql`
    insert into member_ids (
      id, owner_user_id, package_id, is_root, sponsor_id, parent_id, placement_status, status,
      joining_amount_bdt, referral_code, current_level, progression_status, activated_at, origin_kind
    ) values (
      ${childId}, 'u-e', 'builder', true, ${b}, ${b}, 'placed', 'active', 11000,
      'FAIL01', 1, 'ACTIVE', now(), 'attach'
    )`;
  await sql`insert into wallets (member_id, owner_user_id, available_balance, total_released)
    values (${childId}, 'u-e', 0, 0)`;
  await sql`insert into sponsor_relationships (id, sponsor_id, sponsored_id)
    values (${uid()}, ${b}, ${childId})`;

  await assert.rejects(
    () => processMembershipIdActivation(sql, childId, { failAfter: 1 }),
    /ACTIVATION_TEST_FAILURE/,
  );
  assert.equal((await progress(sql, b, 1)).completed_members, 1);
  assert.equal((await progress(sql, a.rootId, 2)).completed_members, 0);

  await processMembershipIdActivation(sql, childId);
  assert.equal((await progress(sql, b, 1)).completed_members, 1);
  assert.equal((await progress(sql, a.rootId, 2)).completed_members, 1);
  const from = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries where source_id = ${childId}`;
  assert.equal(from[0]!.n, 2);
});
