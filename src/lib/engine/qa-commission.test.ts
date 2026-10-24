import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { attachExternalMember, createIdsForPurchase } from "./process.ts";
import { processMembershipIdActivation } from "./activation.ts";
import { uid } from "./ids.ts";
import { LEVELS, fullLevelCommission } from "../rules.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let lastPg: PGlite | undefined;

type Sql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  withTransaction?: <T>(fn: (sql: Sql) => Promise<T>) => Promise<T>;
};

const PER = [880, 660, 330, 220, 132, 110, 110, 110, 110];

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
  await pg.exec(readFileSync(join(ROOT, "migrations/0014_company_share.sql"), "utf8"));
  const sql = wrap(pg);
  sql.withTransaction = async (fn) =>
    pg.transaction(async (tx) => {
      const inner = wrap(tx as unknown as PGlite);
      inner.withTransaction = async (nested) => nested(inner);
      return fn(inner);
    });
  return sql;
}

async function insertUser(sql: Sql, userId: string, name: string) {
  await sql`insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${userId + "@lm.test"}, 'member', ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 12)}, false)`;
}

async function cutover(sql: Sql) {
  await sql`
    insert into app_settings (key, value)
    values ('placement_rules_cutover_at', '2000-01-01T00:00:00.000Z')
    on conflict (key) do update set value = excluded.value
  `;
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

async function levelRow(sql: Sql, memberId: string, level: number) {
  const rows = await sql<{
    placement_completed_members: number;
    status: string;
    accumulated_commission: number;
  }>`
    select placement_completed_members, status, accumulated_commission
    from level_progress where member_id = ${memberId} and level = ${level}`;
  const row = rows[0];
  assert.ok(row, `missing level ${level} for ${memberId}`);
  return {
    n: Number(row.placement_completed_members),
    status: row.status,
    amount: Number(row.accumulated_commission),
  };
}

async function state(sql: Sql, id: string) {
  const rows = await sql<{ current_level: number; progression_status: string }>`
    select current_level, progression_status from member_ids where id = ${id}`;
  return rows[0]!;
}

async function commissionsOf(sql: Sql, beneficiaryId: string) {
  return sql<{ level: number; commission_amount: number; status: string }>`
    select level, commission_amount, status
    from commission_entries
    where beneficiary_id = ${beneficiaryId} and status in ('HELD', 'RELEASED')
    order by level, commission_amount desc, source_id`;
}

/** Sponsors are not placed under the ID, so the ID stays a leaf and its placement count stays 0. */
async function openIncome(sql: Sql, memberId: string) {
  for (let i = 0; i < 3; i += 1) {
    const id = `${memberId}-Q${i}`;
    const owner = `oq${memberId.replace(/[^a-z0-9]/gi, "").slice(0, 8)}${i}`;
    await sql`insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
      values (${owner}, ${owner}, ${owner + "@lm.test"}, 'member', ${"Q" + memberId.replace(/[^A-Z0-9]/gi, "").slice(0, 8) + i}, false)`;
    await sql`
      insert into member_ids (
        id, owner_user_id, package_id, is_root, sponsor_id, parent_id, placement_status, status,
        joining_amount_bdt, referral_code, current_level, progression_status, activated_at, origin_kind
      ) values (
        ${id}, ${owner}, 'builder', true, ${memberId}, null, 'placed', 'active', 11000,
        ${"R" + id}, 1, 'ACTIVE', now(), 'attach'
      )`;
    await sql`
      insert into sponsor_relationships (id, sponsor_id, sponsored_id)
      values (${uid()}, ${memberId}, ${id})
    `;
  }
}

async function placeUnder(sql: Sql, parentId: string, sponsorId: string, tag: string) {
  await insertUser(sql, tag, tag);
  return attachExternalMember(sql, {
    ownerUserId: tag,
    displayName: tag,
    email: null,
    packageId: "builder",
    sponsorMemberId: sponsorId,
    parentMemberId: parentId,
  });
}

async function chain(sql: Sql, parentId: string, sponsorId: string, count: number, tag: string) {
  const ids: string[] = [];
  let parent = parentId;
  for (let i = 0; i < count; i += 1) {
    parent = await placeUnder(sql, parent, sponsorId, `${tag}${String(i).padStart(2, "0")}`);
    ids.push(parent);
  }
  return ids;
}

async function assertRates(sql: Sql) {
  const rows = await sql<{ commission_amount: number; n: number }>`
    select commission_amount, count(*)::int as n
    from commission_entries
    where status in ('HELD', 'RELEASED')
    group by commission_amount`;
  for (const row of rows) {
    assert.ok(PER.includes(Number(row.commission_amount)), `unexpected rate ${row.commission_amount}`);
  }
  const dupes = await sql<{ n: number }>`
    select count(*)::int as n from (
      select beneficiary_id, source_id
      from commission_entries
      where status in ('HELD', 'RELEASED')
      group by beneficiary_id, source_id
      having count(*) > 1
    ) d`;
  assert.equal(dupes[0]?.n, 0);
}

test("locked level table pays 880/660/330/220/132/110 and 150546 for levels 1-9", () => {
  assert.deepEqual(LEVELS.map((l) => l.requiredMembers), [3, 9, 27, 54, 108, 162, 216, 270, 324]);
  assert.deepEqual(
    LEVELS.map((l) => fullLevelCommission(l.level)),
    [2640, 5940, 8910, 11880, 14256, 17820, 23760, 29700, 35640],
  );
  assert.equal(LEVELS.reduce((sum, l) => sum + fullLevelCommission(l.level), 0), 150546);
});

test("QA placement: level 1 releases 2640, the next ID opens level 2 at 660", async () => {
  const sql = await makeSql();
  await insertUser(sql, "qaearnr", "Earner");
  await insertUser(sql, "qaspons", "Sponsor");
  const earner = await createIdsForPurchase(sql, {
    userId: "qaearnr", packageId: "builder", purchaseId: "p-e", externalSponsorId: null,
  });
  const sponsor = await createIdsForPurchase(sql, {
    userId: "qaspons", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  await cutover(sql);
  await openIncome(sql, earner.rootId);

  const placed = await chain(sql, earner.rootId, sponsor.rootId, 2, "qa1a");
  let l1 = await levelRow(sql, earner.rootId, 1);
  assert.equal(l1.n, 2);
  assert.equal(l1.status, "IN_PROGRESS");
  assert.equal(l1.amount, 1760);
  let w = await wallet(sql, earner.rootId);
  assert.equal(w.held, 1760);
  assert.equal(w.available, 0);
  assert.equal((await commissionsOf(sql, sponsor.rootId)).length, 0);

  placed.push(await placeUnder(sql, placed[1]!, sponsor.rootId, "qa1a02"));
  l1 = await levelRow(sql, earner.rootId, 1);
  assert.equal(l1.status, "RELEASED");
  assert.equal(l1.n, 3);
  assert.equal(l1.amount, 2640);
  w = await wallet(sql, earner.rootId);
  assert.equal(w.available, 2640);
  assert.equal(w.released, 2640);
  assert.equal(w.held, 0);
  assert.equal((await state(sql, earner.rootId)).current_level, 2);
  assert.equal((await levelRow(sql, earner.rootId, 2)).n, 0);

  await placeUnder(sql, placed[2]!, sponsor.rootId, "qa1a03");
  const l2 = await levelRow(sql, earner.rootId, 2);
  assert.equal(l2.n, 1);
  assert.equal(l2.status, "IN_PROGRESS");
  assert.equal(l2.amount, 660);
  w = await wallet(sql, earner.rootId);
  assert.equal(w.available, 2640);
  assert.equal(w.held, 660);
  assert.equal(w.released, 2640);
  const rows = await commissionsOf(sql, earner.rootId);
  assert.deepEqual(rows.map((r) => Number(r.commission_amount)), [880, 880, 880, 660]);
  await processMembershipIdActivation(sql, placed[2]!);
  assert.equal((await wallet(sql, earner.rootId)).available, 2640);
  assert.equal((await wallet(sql, earner.rootId)).held, 660);
  await assertRates(sql);
});

test("QA gate: placements pay nothing until 3 sponsors, then older ones count in order", async () => {
  const sql = await makeSql();
  await insertUser(sql, "qbgatee", "Earner");
  await insertUser(sql, "qbgates", "Sponsor");
  await insertUser(sql, "qbgatex", "Anchor");
  const earner = await createIdsForPurchase(sql, {
    userId: "qbgatee", packageId: "builder", purchaseId: "p-e", externalSponsorId: null,
  });
  const sponsor = await createIdsForPurchase(sql, {
    userId: "qbgates", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  const anchor = await createIdsForPurchase(sql, {
    userId: "qbgatex", packageId: "builder", purchaseId: "p-x", externalSponsorId: null,
  });
  await cutover(sql);

  const early = await chain(sql, earner.rootId, sponsor.rootId, 5, "qbpre");
  assert.equal((await commissionsOf(sql, earner.rootId)).length, 0);
  assert.equal((await levelRow(sql, earner.rootId, 1)).n, 0);
  assert.equal((await wallet(sql, earner.rootId)).held, 0);

  const sponsors = await chain(sql, anchor.rootId, earner.rootId, 2, "qbspon");
  assert.equal((await commissionsOf(sql, earner.rootId)).length, 0);
  sponsors.push(await placeUnder(sql, sponsors[1]!, earner.rootId, "qbspon02"));

  const l1 = await levelRow(sql, earner.rootId, 1);
  const l2 = await levelRow(sql, earner.rootId, 2);
  assert.equal(l1.status, "RELEASED");
  assert.equal(l1.n, 3);
  assert.equal(l1.amount, 2640);
  assert.equal(l2.status, "IN_PROGRESS");
  assert.equal(l2.n, 2);
  assert.equal(l2.amount, 1320);
  const w = await wallet(sql, earner.rootId);
  assert.equal(w.available, 2640);
  assert.equal(w.released, 2640);
  assert.equal(w.held, 1320);
  assert.equal((await state(sql, earner.rootId)).current_level, 2);
  const amounts = (await commissionsOf(sql, earner.rootId)).map((r) => Number(r.commission_amount));
  assert.deepEqual(amounts, [880, 880, 880, 660, 660]);
  assert.equal((await commissionsOf(sql, sponsor.rootId)).length, 0);

  const before = await wallet(sql, earner.rootId);
  await processMembershipIdActivation(sql, early[4]!);
  await processMembershipIdActivation(sql, sponsors[2]!);
  const after = await wallet(sql, earner.rootId);
  assert.deepEqual(after, before);

  const slot = await placeUnder(sql, anchor.rootId, sponsor.rootId, "qbslot");
  await placeUnder(sql, slot, sponsor.rootId, "qbfull1");
  await placeUnder(sql, slot, sponsor.rootId, "qbfull2");
  await placeUnder(sql, slot, sponsor.rootId, "qbfull3");
  await assert.rejects(
    placeUnder(sql, slot, sponsor.rootId, "qbfull4"),
    /already has 3/,
  );
  await assertRates(sql);
});

test("QA turbo and super turbo: package tree completes levels, sponsor does not get that commission", async () => {
  const sql = await makeSql();
  await insertUser(sql, "qcturbo", "Buyer");
  await insertUser(sql, "qcplace", "Placer");
  await insertUser(sql, "qcspons", "Sponsor");
  await insertUser(sql, "qcsuper", "Super");
  const placer = await createIdsForPurchase(sql, {
    userId: "qcplace", packageId: "builder", purchaseId: "p-b", externalSponsorId: null,
  });
  const sponsor = await createIdsForPurchase(sql, {
    userId: "qcspons", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  await cutover(sql);
  await openIncome(sql, placer.rootId);
  await sql`
    insert into app_settings (key, value) values
      ('company_share_percent', '1'),
      ('company_share_member_ids', ${sponsor.rootId})
    on conflict (key) do update set value = excluded.value
  `;

  const turbo = await createIdsForPurchase(sql, {
    userId: "qcturbo",
    packageId: "turbo",
    purchaseId: "p-turbo",
    externalSponsorId: sponsor.rootId,
    placementParentId: placer.rootId,
  });
  assert.equal(turbo.ids.length, 4);
  const turboRoot = await levelRow(sql, turbo.rootId, 1);
  assert.equal(turboRoot.status, "RELEASED");
  assert.equal(turboRoot.n, 3);
  assert.equal((await wallet(sql, turbo.rootId)).available, 2640);
  assert.equal((await wallet(sql, turbo.rootId)).held, 0);
  const placerL1 = await levelRow(sql, placer.rootId, 1);
  const placerL2 = await levelRow(sql, placer.rootId, 2);
  assert.equal(placerL1.status, "RELEASED");
  assert.equal(placerL1.n, 3);
  assert.equal(placerL2.n, 1);
  assert.equal(placerL2.amount, 660);
  assert.equal((await wallet(sql, placer.rootId)).available, 2640);
  assert.equal((await wallet(sql, placer.rootId)).held, 660);
  assert.equal((await commissionsOf(sql, sponsor.rootId)).length, 0);
  const sponsorCredits = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_designation_credits
    where sponsor_id = ${sponsor.rootId} and voided_at is null`;
  assert.equal(sponsorCredits[0]?.n, 1);
  const rootCredits = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_designation_credits
    where sponsor_id = ${turbo.rootId} and voided_at is null`;
  assert.equal(rootCredits[0]?.n, 3);
  assert.equal((await wallet(sql, sponsor.rootId)).available, 440);
  assert.equal((await wallet(sql, sponsor.rootId)).released, 0);

  const leaf = turbo.ids[1]!;
  const superPkg = await createIdsForPurchase(sql, {
    userId: "qcsuper",
    packageId: "super_turbo",
    purchaseId: "p-super",
    externalSponsorId: sponsor.rootId,
    placementParentId: leaf,
  });
  assert.equal(superPkg.ids.length, 13);
  const superRootL1 = await levelRow(sql, superPkg.rootId, 1);
  const superRootL2 = await levelRow(sql, superPkg.rootId, 2);
  const superRootL3 = await levelRow(sql, superPkg.rootId, 3);
  assert.equal(superRootL1.status, "RELEASED");
  assert.equal(superRootL2.status, "RELEASED");
  assert.equal(superRootL2.n, 9);
  assert.equal(superRootL2.amount, 5940);
  assert.equal(superRootL3.n, 0);
  assert.equal((await wallet(sql, superPkg.rootId)).available, 2640 + 5940);
  assert.equal((await wallet(sql, superPkg.rootId)).held, 0);
  assert.equal((await state(sql, superPkg.rootId)).current_level, 3);
  for (const id of superPkg.ids.slice(1, 4)) {
    const row = await levelRow(sql, id, 1);
    assert.equal(row.status, "RELEASED");
    assert.equal(row.n, 3);
    assert.equal((await wallet(sql, id)).available, 2640);
    assert.equal((await wallet(sql, id)).held, 0);
  }
  for (const id of superPkg.ids.slice(4)) {
    assert.equal((await commissionsOf(sql, id)).length, 0);
    assert.equal((await wallet(sql, id)).available, 0);
  }
  const placerAfter = await wallet(sql, placer.rootId);
  assert.equal(placerAfter.available, 2640 + 5940);
  assert.equal(placerAfter.held, 5 * 330);
  assert.equal((await levelRow(sql, placer.rootId, 2)).status, "RELEASED");
  assert.equal((await levelRow(sql, placer.rootId, 3)).n, 5);
  assert.equal((await levelRow(sql, placer.rootId, 3)).amount, 1650);
  assert.equal((await commissionsOf(sql, sponsor.rootId)).length, 0);
  const company = await sql<{ n: number }>`
    select count(*)::int as n from wallet_transactions
    where member_id = ${sponsor.rootId} and type = 'COMPANY_SHARE'`;
  assert.equal(company[0]?.n, 4 + 13);
  await assertRates(sql);
});

test("QA level 9 completion graduates the ID and the next placement pays nothing", async () => {
  const sql = await makeSql();
  await insertUser(sql, "qdgrad1", "Earner");
  await insertUser(sql, "qdgrad2", "Sponsor");
  const earner = await createIdsForPurchase(sql, {
    userId: "qdgrad1", packageId: "builder", purchaseId: "p-e", externalSponsorId: null,
  });
  const sponsor = await createIdsForPurchase(sql, {
    userId: "qdgrad2", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  await cutover(sql);
  await openIncome(sql, earner.rootId);
  await sql`
    update member_ids set current_level = 9, progression_status = 'ACTIVE' where id = ${earner.rootId}`;
  await sql`
    update level_progress set status = 'RELEASED', placement_completed_members = required_members
    where member_id = ${earner.rootId} and level < 9`;
  await sql`
    update level_progress
    set status = 'IN_PROGRESS', placement_completed_members = 323, remaining_members = 1
    where member_id = ${earner.rootId} and level = 9`;

  const last = await placeUnder(sql, earner.rootId, sponsor.rootId, "qdlast1");
  assert.equal((await state(sql, earner.rootId)).progression_status, "GRADUATED");
  assert.equal((await state(sql, earner.rootId)).current_level, 9);
  const l9 = await levelRow(sql, earner.rootId, 9);
  assert.equal(l9.status, "RELEASED");
  assert.equal(l9.n, 324);
  assert.equal((await wallet(sql, earner.rootId)).available, 110);
  assert.equal((await wallet(sql, earner.rootId)).held, 0);
  assert.equal((await commissionsOf(sql, earner.rootId)).length, 1);

  await placeUnder(sql, last, sponsor.rootId, "qdlast2");
  assert.equal((await commissionsOf(sql, earner.rootId)).length, 1);
  assert.equal((await wallet(sql, earner.rootId)).available, 110);
  assert.equal((await state(sql, earner.rootId)).progression_status, "GRADUATED");
  await assertRates(sql);
});

test("QA an exempt ancestor gets no level commission; the ID under it still does", async () => {
  const sql = await makeSql();
  await insertUser(sql, "qeexemp", "Exempt");
  await insertUser(sql, "qemid01", "Mid");
  await insertUser(sql, "qespons", "Sponsor");
  const exempt = await createIdsForPurchase(sql, {
    userId: "qeexemp", packageId: "builder", purchaseId: "p-x", externalSponsorId: null,
  });
  const sponsor = await createIdsForPurchase(sql, {
    userId: "qespons", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  await cutover(sql);
  await sql`
    insert into app_settings (key, value)
    values ('company_level_exempt_member_ids', ${exempt.rootId})
    on conflict (key) do update set value = excluded.value
  `;
  const mid = await createIdsForPurchase(sql, {
    userId: "qemid01",
    packageId: "builder",
    purchaseId: "p-m",
    externalSponsorId: sponsor.rootId,
    placementParentId: exempt.rootId,
  });
  await openIncome(sql, mid.rootId);
  await placeUnder(sql, mid.rootId, sponsor.rootId, "qedown1");
  assert.equal((await commissionsOf(sql, exempt.rootId)).length, 0);
  assert.equal((await wallet(sql, exempt.rootId)).held, 0);
  assert.equal((await wallet(sql, exempt.rootId)).available, 0);
  const midL1 = await levelRow(sql, mid.rootId, 1);
  assert.equal(midL1.n, 1);
  assert.equal(midL1.amount, 880);
  assert.equal((await wallet(sql, mid.rootId)).held, 880);
  assert.equal((await wallet(sql, mid.rootId)).available, 0);
});

test("QA hyper turbo: 22 IDs fill level 1, level 2, and 10 of level 3", async () => {
  const sql = await makeSql();
  await insertUser(sql, "qhplace", "Placer");
  await insertUser(sql, "qhspons", "Sponsor");
  await insertUser(sql, "qhbuyer", "Buyer");
  const placer = await createIdsForPurchase(sql, {
    userId: "qhplace", packageId: "builder", purchaseId: "p-b", externalSponsorId: null,
  });
  const sponsor = await createIdsForPurchase(sql, {
    userId: "qhspons", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  await cutover(sql);
  await openIncome(sql, placer.rootId);
  const hyper = await createIdsForPurchase(sql, {
    userId: "qhbuyer",
    packageId: "hyper_turbo",
    purchaseId: "p-hyper",
    externalSponsorId: sponsor.rootId,
    placementParentId: placer.rootId,
  });
  assert.equal(hyper.ids.length, 22);

  const rootL1 = await levelRow(sql, hyper.rootId, 1);
  const rootL2 = await levelRow(sql, hyper.rootId, 2);
  const rootL3 = await levelRow(sql, hyper.rootId, 3);
  assert.equal(rootL1.status, "RELEASED");
  assert.equal(rootL1.amount, 2640);
  assert.equal(rootL2.status, "RELEASED");
  assert.equal(rootL2.n, 9);
  assert.equal(rootL2.amount, 5940);
  assert.equal(rootL3.status, "IN_PROGRESS");
  assert.equal(rootL3.n, 9);
  assert.equal(rootL3.amount, 2970);
  assert.equal((await wallet(sql, hyper.rootId)).available, 8580);
  assert.equal((await wallet(sql, hyper.rootId)).held, 2970);
  assert.equal((await state(sql, hyper.rootId)).current_level, 3);

  for (const id of [hyper.ids[5]!, hyper.ids[8]!, hyper.ids[11]!]) {
    const row = await levelRow(sql, id, 1);
    assert.equal(row.status, "RELEASED");
    assert.equal(row.n, 3);
    assert.equal((await wallet(sql, id)).available, 2640);
    assert.equal((await wallet(sql, id)).held, 0);
  }
  const branch = await wallet(sql, hyper.ids[1]!);
  assert.equal(branch.available, 2640);
  assert.equal(branch.held, 1980);
  assert.equal((await levelRow(sql, hyper.ids[1]!, 2)).n, 3);

  const placed = await wallet(sql, placer.rootId);
  assert.equal(placed.available, 8580);
  assert.equal(placed.held, 3300);
  assert.equal((await levelRow(sql, placer.rootId, 3)).n, 10);
  assert.equal((await levelRow(sql, placer.rootId, 3)).amount, 3300);
  assert.equal((await commissionsOf(sql, sponsor.rootId)).length, 0);
  const credits = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_designation_credits
    where sponsor_id = ${sponsor.rootId} and voided_at is null`;
  assert.equal(credits[0]?.n, 1);
  await assertRates(sql);
});

test("QA 39 placements complete levels 1, 2, and 3 for exactly 17490", async () => {
  const sql = await makeSql();
  await insertUser(sql, "qlongen", "Earner");
  await insertUser(sql, "qlongsp", "Sponsor");
  const earner = await createIdsForPurchase(sql, {
    userId: "qlongen", packageId: "builder", purchaseId: "p-e", externalSponsorId: null,
  });
  const sponsor = await createIdsForPurchase(sql, {
    userId: "qlongsp", packageId: "builder", purchaseId: "p-s", externalSponsorId: null,
  });
  await cutover(sql);
  await openIncome(sql, earner.rootId);
  await chain(sql, earner.rootId, sponsor.rootId, 39, "ql");
  assert.equal((await levelRow(sql, earner.rootId, 1)).status, "RELEASED");
  assert.equal((await levelRow(sql, earner.rootId, 2)).status, "RELEASED");
  assert.equal((await levelRow(sql, earner.rootId, 2)).amount, 5940);
  assert.equal((await levelRow(sql, earner.rootId, 3)).status, "RELEASED");
  assert.equal((await levelRow(sql, earner.rootId, 3)).n, 27);
  assert.equal((await levelRow(sql, earner.rootId, 3)).amount, 8910);
  assert.equal((await levelRow(sql, earner.rootId, 4)).n, 0);
  assert.equal((await state(sql, earner.rootId)).current_level, 4);
  const w = await wallet(sql, earner.rootId);
  assert.equal(w.available, 2640 + 5940 + 8910);
  assert.equal(w.released, 17490);
  assert.equal(w.held, 0);
  assert.equal((await commissionsOf(sql, sponsor.rootId)).length, 0);
  await assertRates(sql);
});
