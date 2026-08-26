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

test("turbo: external sponsor earns 880 from root only; root L1 releases 2640", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-sponsor", "Sponsor");
  await insertUser(sql, "u-buyer", "Buyer");
  const sponsor = await createIdsForPurchase(sql, {
    userId: "u-sponsor",
    packageId: "builder",
    purchaseId: "p-sp",
    externalSponsorId: null,
  });
  const buyer = await createIdsForPurchase(sql, {
    userId: "u-buyer",
    packageId: "turbo",
    purchaseId: "p-turbo",
    externalSponsorId: sponsor.rootId,
  });
  assert.equal(buyer.ids.length, 4);

  const sponsorComm = await commissionsFrom(sql, sponsor.rootId);
  assert.equal(sponsorComm.length, 1);
  assert.equal(sponsorComm[0]!.source_id, buyer.rootId);
  assert.equal(sponsorComm[0]!.generation, 1);
  assert.equal(Number(sponsorComm[0]!.commission_amount), 880);
  assert.equal(sponsorComm[0]!.status, "HELD");

  const spL1 = await progress(sql, sponsor.rootId, 1);
  assert.equal(spL1.completed_members, 1);
  assert.equal(spL1.status, "IN_PROGRESS");
  const spW = await wallet(sql, sponsor.rootId);
  assert.equal(spW.held, 880);
  assert.equal(spW.available, 0);

  const rootComm = await commissionsFrom(sql, buyer.rootId);
  assert.equal(rootComm.length, 3);
  assert.equal(rootComm.every((c) => c.generation === 1 && Number(c.commission_amount) === 880), true);
  assert.equal(rootComm.every((c) => c.status === "RELEASED"), true);

  const rootL1 = await progress(sql, buyer.rootId, 1);
  assert.equal(rootL1.completed_members, 3);
  assert.equal(rootL1.status, "RELEASED");
  const rootW = await wallet(sql, buyer.rootId);
  assert.equal(rootW.available, 2640);
  assert.equal(rootW.held, 0);
  assert.equal(rootW.released, 2640);

  const internals = buyer.ids.slice(1);
  for (const id of internals) {
    const asSource = await sql<{ n: number }>`
      select count(*)::int as n from commission_entries
      where source_id = ${id} and beneficiary_id = ${sponsor.rootId}
    `;
    assert.equal(asSource[0]!.n, 0, `sponsor must not earn from internal ${id}`);
  }
});

test("replaying processNewId does not duplicate commission or generation", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-s", "S");
  await insertUser(sql, "u-b", "B");
  const sponsor = await createIdsForPurchase(sql, {
    userId: "u-s",
    packageId: "builder",
    purchaseId: "p1",
    externalSponsorId: null,
  });
  const buyer = await createIdsForPurchase(sql, {
    userId: "u-b",
    packageId: "turbo",
    purchaseId: "p2",
    externalSponsorId: sponsor.rootId,
  });
  await processNewId(sql, buyer.rootId);
  await processNewId(sql, buyer.ids[1]!);
  const sponsorComm = await commissionsFrom(sql, sponsor.rootId);
  assert.equal(sponsorComm.length, 1);
  const gens = await sql<{ n: number }>`
    select count(*)::int as n from generation_memberships where beneficiary_id = ${sponsor.rootId}
  `;
  assert.equal(gens[0]!.n, 1);
  const rootComm = await commissionsFrom(sql, buyer.rootId);
  assert.equal(rootComm.length, 3);
});

test("super turbo places 1+3+9 and completes root L1+L2", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-st", "Super");
  const created = await createIdsForPurchase(sql, {
    userId: "u-st",
    packageId: "super_turbo",
    purchaseId: "p-st",
    externalSponsorId: null,
  });
  assert.equal(created.ids.length, 13);
  const placed = await sql<{ n: number }>`
    select count(*)::int as n from member_ids where purchase_id = ${"p-st"} and placement_status = 'placed'
  `;
  assert.equal(placed[0]!.n, 13);
  const l1 = await progress(sql, created.rootId, 1);
  const l2 = await progress(sql, created.rootId, 2);
  assert.equal(l1.completed_members, 3);
  assert.equal(l1.status, "RELEASED");
  assert.equal(l2.completed_members, 9);
  assert.equal(l2.status, "RELEASED");
  const w = await wallet(sql, created.rootId);
  assert.equal(w.available, 2640 + 5940);
  assert.equal(w.held, 0);
  const gens = await sql<{ generation: number; n: number }>`
    select generation, count(*)::int as n from generation_memberships
    where beneficiary_id = ${created.rootId} group by generation order by generation
  `;
  assert.equal(gens.find((g) => g.generation === 1)?.n, 3);
  assert.equal(gens.find((g) => g.generation === 2)?.n, 9);
});

test("hyper turbo: 13 placed, 9 unplaced, unplaced IDs generate no commission", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-ht", "Hyper");
  const created = await createIdsForPurchase(sql, {
    userId: "u-ht",
    packageId: "hyper_turbo",
    purchaseId: "p-ht",
    externalSponsorId: null,
  });
  assert.equal(created.ids.length, 22);
  const pending = await sql<{ id: string }>`
    select id from member_ids where purchase_id = ${"p-ht"} and placement_status = 'pending_config'
    order by id
  `;
  assert.equal(pending.length, 9);
  for (const row of pending) {
    const asSource = await sql<{ n: number }>`
      select count(*)::int as n from commission_entries where source_id = ${row.id}
    `;
    const asChild = await sql<{ n: number }>`
      select count(*)::int as n from generation_memberships where member_id = ${row.id}
    `;
    const asSponsored = await sql<{ n: number }>`
      select count(*)::int as n from sponsor_relationships where sponsored_id = ${row.id}
    `;
    assert.equal(asSource[0]!.n, 0);
    assert.equal(asChild[0]!.n, 0);
    assert.equal(asSponsored[0]!.n, 0);
  }
  const l2 = await progress(sql, created.rootId, 2);
  assert.equal(l2.completed_members, 9);
  assert.equal(l2.status, "RELEASED");
});

test("sample turbo: L1 released 2640, L2 6/9 held 3960, then 9/9 releases 5940 once", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-demo", "Demo");
  const turbo = await createIdsForPurchase(sql, {
    userId: "u-demo",
    packageId: "turbo",
    purchaseId: "p-demo",
    externalSponsorId: null,
  });
  const internals = turbo.ids.slice(1);
  for (let i = 0; i < 6; i++) {
    const synth = `synth-${i}`;
    await sql`
      insert into app_users (user_id, display_name, role, referral_code, is_synthetic)
      values (${synth}, ${"Member " + i}, 'member', ${"SM" + i + "XX"}, true)
    `;
    await attachExternalMember(sql, {
      ownerUserId: synth,
      displayName: "Member",
      email: null,
      packageId: "builder",
      sponsorMemberId: internals[i % 3]!,
      parentMemberId: internals[i % 3]!,
    });
  }
  const l1 = await progress(sql, turbo.rootId, 1);
  const l2 = await progress(sql, turbo.rootId, 2);
  const w = await wallet(sql, turbo.rootId);
  assert.equal(l1.status, "RELEASED");
  assert.equal(l1.completed_members, 3);
  assert.equal(l2.completed_members, 6);
  assert.equal(l2.status, "IN_PROGRESS");
  assert.equal(l2.accumulated_commission, 3960);
  assert.equal(w.available, 2640);
  assert.equal(w.held, 3960);

  const gens = await sql<{ generation: number; n: number }>`
    select generation, count(*)::int as n from generation_memberships
    where beneficiary_id = ${turbo.rootId} group by generation
  `;
  assert.equal(gens.find((g) => g.generation === 1)?.n, 3);
  assert.equal(gens.find((g) => g.generation === 2)?.n, 6);

  for (let i = 0; i < 3; i++) {
    const synth = `closer-${i}`;
    await sql`
      insert into app_users (user_id, display_name, role, referral_code, is_synthetic)
      values (${synth}, ${"Closer " + i}, 'member', ${"CL" + i + "XX"}, true)
    `;
    await attachExternalMember(sql, {
      ownerUserId: synth,
      displayName: "Closer",
      email: null,
      packageId: "builder",
      sponsorMemberId: internals[i]!,
      parentMemberId: internals[i]!,
    });
  }
  const l2b = await progress(sql, turbo.rootId, 2);
  const wb = await wallet(sql, turbo.rootId);
  assert.equal(l2b.completed_members, 9);
  assert.equal(l2b.status, "RELEASED");
  assert.equal(wb.held, 0);
  assert.equal(wb.available, 2640 + 5940);
  const releases = await sql<{ n: number; total: number }>`
    select count(*)::int as n, coalesce(sum(amount),0)::int as total
    from wallet_transactions where member_id = ${turbo.rootId} and type = 'RELEASE' and level = 2
  `;
  assert.equal(releases[0]!.n, 1);
  assert.equal(Number(releases[0]!.total), 5940);
});

test("generation identities are not reclassified after later levels complete", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-g", "Gen");
  const turbo = await createIdsForPurchase(sql, {
    userId: "u-g",
    packageId: "super_turbo",
    purchaseId: "p-g",
    externalSponsorId: null,
  });
  const before = await sql<{ member_id: string; generation: number }>`
    select member_id, generation from generation_memberships
    where beneficiary_id = ${turbo.rootId} order by generation, member_id
  `;
  for (const id of turbo.ids) await processNewId(sql, id);
  const after = await sql<{ member_id: string; generation: number }>`
    select member_id, generation from generation_memberships
    where beneficiary_id = ${turbo.rootId} order by generation, member_id
  `;
  assert.deepEqual(after, before);
  assert.equal(before.filter((r) => r.generation === 1).length, 3);
  assert.equal(before.filter((r) => r.generation === 2).length, 9);
});

test("reversal preserves ledger rows, claws back released wallet, reopens incomplete level", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-r", "Rev");
  const turbo = await createIdsForPurchase(sql, {
    userId: "u-r",
    packageId: "turbo",
    purchaseId: "p-r",
    externalSponsorId: null,
  });
  const internals = turbo.ids.slice(1);
  const sources: string[] = [];
  for (let i = 0; i < 9; i++) {
    const synth = `rv-${i}`;
    await sql`
      insert into app_users (user_id, display_name, role, referral_code, is_synthetic)
      values (${synth}, ${"R " + i}, 'member', ${"RV" + i + "XX"}, true)
    `;
    const id = await attachExternalMember(sql, {
      ownerUserId: synth,
      displayName: "R",
      email: null,
      packageId: "builder",
      sponsorMemberId: internals[i % 3]!,
      parentMemberId: internals[i % 3]!,
    });
    sources.push(id);
  }
  const before = await wallet(sql, turbo.rootId);
  assert.equal(before.available, 2640 + 5940);

  const result = await reverseJoin(sql, {
    sourceId: sources[0]!,
    actorUserId: "u-r",
    reason: "QA reverse",
  });
  assert.equal(result.reversed >= 1, true);

  const reversedRows = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries
    where source_id = ${sources[0]!} and status = 'REVERSED'
  `;
  assert.equal(reversedRows[0]!.n >= 1, true);
  const deleted = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries where source_id = ${sources[0]!}
  `;
  assert.equal(deleted[0]!.n >= 1, true, "ledger history is kept");

  const l2 = await progress(sql, turbo.rootId, 2);
  assert.equal(l2.completed_members, 8);
  assert.equal(l2.status, "IN_PROGRESS");
  const after = await wallet(sql, turbo.rootId);
  assert.equal(after.available, 2640 + 5940 - 660);
  assert.equal(after.released, 2640 + 5940 - 660);
  const clawbacks = await sql<{ n: number }>`
    select count(*)::int as n from wallet_transactions
    where member_id = ${turbo.rootId} and type = 'REVERSAL'
  `;
  assert.equal(clawbacks[0]!.n, 1);
});

test("Level 1 0/1/2/3 hold then full release, no partial", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-l1", "L1");
  const root = await createIdsForPurchase(sql, {
    userId: "u-l1",
    packageId: "builder",
    purchaseId: "p-l1",
    externalSponsorId: null,
  });
  const expectedHeld = [0, 880, 1760, 2640];
  for (let i = 0; i < 3; i++) {
    const synth = `d-${i}`;
    await sql`
      insert into app_users (user_id, display_name, role, referral_code, is_synthetic)
      values (${synth}, ${"D " + i}, 'member', ${"DD" + i + "XX"}, true)
    `;
    await attachExternalMember(sql, {
      ownerUserId: synth,
      displayName: "D",
      email: null,
      packageId: "builder",
      sponsorMemberId: root.rootId,
      parentMemberId: root.rootId,
    });
    const l1 = await progress(sql, root.rootId, 1);
    const w = await wallet(sql, root.rootId);
    assert.equal(l1.completed_members, i + 1);
    if (i < 2) {
      assert.equal(l1.status, "IN_PROGRESS");
      assert.equal(w.held, expectedHeld[i + 1]);
      assert.equal(w.available, 0);
    } else {
      assert.equal(l1.status, "RELEASED");
      assert.equal(w.held, 0);
      assert.equal(w.available, 2640);
    }
  }
});
