import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PACKAGES, type PackageId } from "../rules.ts";
import { planPackagePlacement } from "./placement.ts";
import { createIdsForPurchase } from "./process.ts";
import { formatMemberId, makeReferralCode } from "./ids.ts";
import { assertAcyclicSponsor, wouldCreateSponsorCycle } from "./activation.ts";
import {
  approvePayment,
  savePaymentMethod,
  submitPaymentRequest,
} from "../payments/engine.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
let lastPg: PGlite | undefined;

type Sql = {
  <T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  withTransaction?: <T>(fn: (sql: Sql) => Promise<T>) => Promise<T>;
};

type Queryable = {
  query: <T>(text: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

function bind(client: Queryable): Sql {
  const sql = (async <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await client.query<T>(text, values);
    return result.rows;
  }) as Sql;
  return sql;
}

function wrap(pg: PGlite): Sql {
  const sql = bind(pg);
  sql.withTransaction = async <T>(fn: (tx: Sql) => Promise<T>) => {
    return pg.transaction(async (tx) => {
      const inner = bind(tx);
      inner.withTransaction = async (nested) => nested(inner);
      return fn(inner);
    });
  };
  return sql;
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
  await pg.exec(readFileSync(join(ROOT, "migrations/0003_hardening.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0005_manual_payments.sql"), "utf8"));
  await pg.exec(readFileSync(join(ROOT, "migrations/0010_id_based_engine.sql"), "utf8"));
  return wrap(pg);
}

async function insertUser(sql: Sql, userId: string, name: string, role = "member") {
  await sql`insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values (${userId}, ${name}, ${userId + "@lm.test"}, ${role}, ${userId.replace(/[^a-z0-9]/gi, "").slice(0, 6).padEnd(6, "X")}, false)`;
}

async function configureMethods(sql: Sql) {
  await insertUser(sql, "admin1", "Admin", "admin");
  await savePaymentMethod(sql, "admin1", { method: "CASH", enabled: true, instructions: "Pay at office." });
  await savePaymentMethod(sql, "admin1", { method: "BKASH", enabled: true, number: "01700000000" });
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

async function commissionTotals(sql: Sql, beneficiaryId: string) {
  const rows = await sql<{ status: string; n: number; amt: number }>`
    select status, count(*)::int as n, coalesce(sum(commission_amount),0)::int as amt
    from commission_entries where beneficiary_id = ${beneficiaryId}
    group by status`;
  const out = { HELD: { n: 0, amt: 0 }, RELEASED: { n: 0, amt: 0 }, REVERSED: { n: 0, amt: 0 } };
  for (const row of rows) {
    const key = row.status as keyof typeof out;
    if (out[key]) out[key] = { n: Number(row.n), amt: Number(row.amt) };
  }
  return out;
}

async function uniqueReferralCodes(sql: Sql, purchaseId: string) {
  const rows = await sql<{ n: number; distinct: number }>`
    select count(*)::int as n, count(distinct referral_code)::int as distinct
    from member_ids where purchase_id = ${purchaseId}`;
  return rows[0]!;
}

async function sponsorKids(sql: Sql, sponsorId: string) {
  return sql<{ sponsored_id: string }>`
    select sponsored_id from sponsor_relationships where sponsor_id = ${sponsorId} order by sponsored_id`;
}

async function placementKids(sql: Sql, parentId: string) {
  return sql<{ child_id: string }>`
    select child_id from placement_relationships where parent_id = ${parentId} order by child_id`;
}

async function assertNoSponsorCycle(sql: Sql, ids: string[]) {
  for (const id of ids) {
    const seen = new Set<string>();
    let node: string | null = id;
    let hops = 0;
    while (node && hops < 64) {
      assert.equal(seen.has(node), false, `sponsor cycle at ${node}`);
      seen.add(node);
      const current: string = node;
      const row: { sponsor_id: string | null }[] = await sql`select sponsor_id from member_ids where id = ${current}`;
      node = row[0]?.sponsor_id ?? null;
      hops += 1;
    }
  }
}

async function seedSponsor(sql: Sql) {
  await insertUser(sql, "u-x", "Sponsor X");
  return createIdsForPurchase(sql, {
    userId: "u-x",
    packageId: "builder",
    purchaseId: "p-x",
    externalSponsorId: null,
  });
}

const PACKAGE_COUNTS: Record<PackageId, number> = {
  builder: 1,
  turbo: 4,
  super_turbo: 13,
  hyper_turbo: 22,
};

test("referral codes do not collapse sequential Membership IDs", () => {
  const codes = new Set<string>();
  for (let n = 100001; n <= 100400; n++) {
    codes.add(makeReferralCode(formatMemberId(n)));
  }
  assert.equal(codes.size, 400);
  assert.equal([...codes][0]!.length, 6);
});

test("A. BUILDER: exactly 1 ID, X sponsors root only, activation once, L1 0/3", async () => {
  const sql = await makeSql();
  const x = await seedSponsor(sql);
  await insertUser(sql, "u-a", "Builder buyer");
  const created = await createIdsForPurchase(sql, {
    userId: "u-a",
    packageId: "builder",
    purchaseId: "p-a",
    externalSponsorId: x.rootId,
  });
  assert.equal(created.ids.length, 1);
  assert.equal(created.rootId, created.ids[0]);
  const members = await sql<{ id: string; is_root: boolean; origin_kind: string; sponsor_id: string | null; referral_code: string }>`
    select id, is_root, origin_kind, sponsor_id, referral_code from member_ids where purchase_id = ${"p-a"}`;
  assert.equal(members.length, 1);
  assert.equal(members[0]!.is_root, true);
  assert.equal(members[0]!.origin_kind, "purchase_root");
  assert.equal(members[0]!.sponsor_id, x.rootId);
  assert.ok(members[0]!.referral_code);
  const ext = await sponsorKids(sql, x.rootId);
  assert.equal(ext.length, 1);
  assert.equal(ext[0]!.sponsored_id, created.rootId);
  const internals = await sponsorKids(sql, created.rootId);
  assert.equal(internals.length, 0);
  const events = await sql<{ n: number }>`select count(*)::int as n from membership_activation_events where member_id = ${created.rootId}`;
  assert.equal(events[0]!.n, 1);
  const l1 = await progress(sql, created.rootId, 1);
  assert.equal(l1.completed_members, 0);
  assert.equal(l1.status, "IN_PROGRESS");
  const buyerComm = await commissionTotals(sql, created.rootId);
  assert.equal(buyerComm.HELD.n + buyerComm.RELEASED.n, 0);
  const xComm = await commissionTotals(sql, x.rootId);
  assert.equal(xComm.HELD.n, 1);
  assert.equal(xComm.HELD.amt, 880);
});

test("B. TURBO: 4 IDs, root L1 3/3 via internals, unique referrals, no duplicate IDs", async () => {
  const sql = await makeSql();
  const x = await seedSponsor(sql);
  await insertUser(sql, "u-b", "Turbo buyer");
  const created = await createIdsForPurchase(sql, {
    userId: "u-b",
    packageId: "turbo",
    purchaseId: "p-b",
    externalSponsorId: x.rootId,
  });
  assert.equal(created.ids.length, 4);
  assert.equal(new Set(created.ids).size, 4);
  const refs = await uniqueReferralCodes(sql, "p-b");
  assert.equal(refs.n, 4);
  assert.equal(refs.distinct, 4);
  const kids = await sponsorKids(sql, created.rootId);
  assert.equal(kids.length, 3);
  for (const id of created.ids.slice(1)) {
    assert.ok(kids.some((k) => k.sponsored_id === id));
  }
  const ext = await sponsorKids(sql, x.rootId);
  assert.equal(ext.length, 1);
  assert.equal(ext[0]!.sponsored_id, created.rootId);
  const l1 = await progress(sql, created.rootId, 1);
  assert.equal(l1.completed_members, 3);
  assert.equal(l1.status, "RELEASED");
  const rootW = await wallet(sql, created.rootId);
  assert.equal(rootW.available, 2640);
  assert.equal(rootW.released, 2640);
  const rootComm = await commissionTotals(sql, created.rootId);
  assert.equal(rootComm.RELEASED.n, 3);
  assert.equal(rootComm.RELEASED.amt, 2640);
  for (const id of created.ids.slice(1)) {
    const childL1 = await progress(sql, id, 1);
    assert.equal(childL1.completed_members, 0);
    assert.equal(childL1.status, "IN_PROGRESS");
    const childComm = await commissionTotals(sql, id);
    assert.equal(childComm.HELD.n + childComm.RELEASED.n, 0);
  }
  const xL1 = await progress(sql, x.rootId, 1);
  assert.equal(xL1.completed_members, 1);
  assert.equal(xL1.status, "IN_PROGRESS");
});

test("C. SUPER TURBO: 13 IDs, exact trees, root + A/B/C complete L1 independently", async () => {
  const sql = await makeSql();
  const x = await seedSponsor(sql);
  await insertUser(sql, "u-c", "Super buyer");
  const created = await createIdsForPurchase(sql, {
    userId: "u-c",
    packageId: "super_turbo",
    purchaseId: "p-c",
    externalSponsorId: x.rootId,
  });
  assert.equal(created.ids.length, 13);
  const [root, a, b, c] = created.ids;
  assert.equal((await sponsorKids(sql, root!)).length, 3);
  assert.equal((await sponsorKids(sql, a!)).length, 3);
  assert.equal((await sponsorKids(sql, b!)).length, 3);
  assert.equal((await sponsorKids(sql, c!)).length, 3);
  assert.equal((await placementKids(sql, a!)).length, 3);
  assert.equal((await placementKids(sql, b!)).length, 3);
  assert.equal((await placementKids(sql, c!)).length, 3);
  const ext = await sponsorKids(sql, x.rootId);
  assert.equal(ext.length, 1);
  assert.equal(ext[0]!.sponsored_id, root);
  for (const id of created.ids.slice(1)) {
    const rel = await sql<{ n: number }>`
      select count(*)::int as n from sponsor_relationships
      where sponsor_id = ${x.rootId} and sponsored_id = ${id}`;
    assert.equal(rel[0]!.n, 0);
  }
  const rootL1 = await progress(sql, root!, 1);
  const rootL2 = await progress(sql, root!, 2);
  assert.equal(rootL1.status, "RELEASED");
  assert.equal(rootL2.status, "RELEASED");
  for (const id of [a, b, c]) {
    const l1 = await progress(sql, id!, 1);
    assert.equal(l1.completed_members, 3);
    assert.equal(l1.status, "RELEASED");
    const w = await wallet(sql, id!);
    assert.equal(w.available, 2640);
  }
  const owners = await sql<{ n: number }>`
    select count(distinct owner_user_id)::int as n from member_ids where purchase_id = ${"p-c"}`;
  assert.equal(owners[0]!.n, 1);
  const refs = await uniqueReferralCodes(sql, "p-c");
  assert.equal(refs.distinct, 13);
});

test("D. HYPER TURBO: 22 IDs, first 13 + final 9 under A2/B2/C2, unplaced = 0", async () => {
  const sql = await makeSql();
  const x = await seedSponsor(sql);
  await insertUser(sql, "u-d", "Hyper buyer");
  const created = await createIdsForPurchase(sql, {
    userId: "u-d",
    packageId: "hyper_turbo",
    purchaseId: "p-d",
    externalSponsorId: x.rootId,
  });
  assert.equal(created.ids.length, 22);
  const pending = await sql<{ n: number }>`
    select count(*)::int as n from member_ids where purchase_id = ${"p-d"} and placement_status = 'pending_config'`;
  assert.equal(pending[0]!.n, 0);
  const placed = await sql<{ n: number }>`
    select count(*)::int as n from member_ids where purchase_id = ${"p-d"} and placement_status = 'placed'`;
  assert.equal(placed[0]!.n, 22);
  const a2 = created.ids[5]!;
  const b2 = created.ids[8]!;
  const c2 = created.ids[11]!;
  const a2Kids = (await sponsorKids(sql, a2)).map((r) => r.sponsored_id);
  const b2Kids = (await sponsorKids(sql, b2)).map((r) => r.sponsored_id);
  const c2Kids = (await sponsorKids(sql, c2)).map((r) => r.sponsored_id);
  assert.deepEqual(a2Kids.sort(), [created.ids[13], created.ids[14], created.ids[15]].sort());
  assert.deepEqual(b2Kids.sort(), [created.ids[16], created.ids[17], created.ids[18]].sort());
  assert.deepEqual(c2Kids.sort(), [created.ids[19], created.ids[20], created.ids[21]].sort());
  assert.equal((await placementKids(sql, a2)).length, 3);
  assert.equal((await placementKids(sql, b2)).length, 3);
  assert.equal((await placementKids(sql, c2)).length, 3);
  const sponsorRows = await sql<{ n: number; distinct: number }>`
    select count(*)::int as n, count(distinct sponsored_id)::int as distinct
    from sponsor_relationships sr
    join member_ids m on m.id = sr.sponsored_id
    where m.purchase_id = ${"p-d"}`;
  assert.equal(sponsorRows[0]!.n, 22);
  assert.equal(sponsorRows[0]!.distinct, 22);
  const placementRows = await sql<{ n: number; distinct: number }>`
    select count(*)::int as n, count(distinct child_id)::int as distinct
    from placement_relationships pr
    join member_ids m on m.id = pr.child_id
    where m.purchase_id = ${"p-d"}`;
  assert.equal(placementRows[0]!.n, 22);
  assert.equal(placementRows[0]!.distinct, 22);
  const ext = await sponsorKids(sql, x.rootId);
  assert.equal(ext.length, 1);
  assert.equal(ext[0]!.sponsored_id, created.rootId);
  for (const id of [a2, b2, c2]) {
    const l1 = await progress(sql, id, 1);
    assert.equal(l1.status, "RELEASED");
    assert.equal(l1.completed_members, 3);
  }
});

test("E. EXTERNAL SPONSOR attaches to root only for every package", async () => {
  const sql = await makeSql();
  const x = await seedSponsor(sql);
  for (const packageId of Object.keys(PACKAGE_COUNTS) as PackageId[]) {
    const userId = `u-e-${packageId}`;
    await insertUser(sql, userId, packageId);
    const created = await createIdsForPurchase(sql, {
      userId,
      packageId,
      purchaseId: `p-e-${packageId}`,
      externalSponsorId: x.rootId,
    });
    const direct = await sql<{ n: number }>`
      select count(*)::int as n from sponsor_relationships sr
      join member_ids m on m.id = sr.sponsored_id
      where sr.sponsor_id = ${x.rootId} and m.purchase_id = ${"p-e-" + packageId}`;
    assert.equal(direct[0]!.n, 1, packageId);
    const rootRel = await sql<{ n: number }>`
      select count(*)::int as n from sponsor_relationships
      where sponsor_id = ${x.rootId} and sponsored_id = ${created.rootId}`;
    assert.equal(rootRel[0]!.n, 1, packageId);
  }
  const totalDirect = await sponsorKids(sql, x.rootId);
  assert.equal(totalDirect.length, 4);
});

test("F. SAME OWNER: many IDs stay independent nodes", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-f", "Owner");
  const first = await createIdsForPurchase(sql, {
    userId: "u-f",
    packageId: "builder",
    purchaseId: "p-f1",
    externalSponsorId: null,
  });
  const turbo = await createIdsForPurchase(sql, {
    userId: "u-f",
    packageId: "turbo",
    purchaseId: "p-f2",
    externalSponsorId: first.rootId,
  });
  const owned = await sql<{ id: string; referral_code: string; current_level: number; progression_status: string }>`
    select id, referral_code, current_level, progression_status from member_ids where owner_user_id = ${"u-f"}`;
  assert.equal(owned.length, 5);
  assert.equal(new Set(owned.map((r) => r.referral_code)).size, 5);
  const turboRoot = await progress(sql, turbo.rootId, 1);
  assert.equal(turboRoot.status, "RELEASED");
  const builderL1 = await progress(sql, first.rootId, 1);
  assert.equal(builderL1.completed_members, 1);
  assert.equal(builderL1.status, "IN_PROGRESS");
  const turboComm = await commissionTotals(sql, turbo.rootId);
  const builderComm = await commissionTotals(sql, first.rootId);
  assert.equal(turboComm.RELEASED.amt, 2640);
  assert.equal(builderComm.HELD.amt, 880);
  assert.notEqual(turbo.rootId, first.rootId);
  for (const id of turbo.ids.slice(1)) {
    const l1 = await progress(sql, id, 1);
    assert.equal(l1.completed_members, 0);
  }
});

test("G. REPLAY: second create/approve does not duplicate package, IDs, relations, or commissions", async () => {
  const sql = await makeSql();
  await configureMethods(sql);
  await insertUser(sql, "u-g", "Replay buyer");
  const created = await createIdsForPurchase(sql, {
    userId: "u-g",
    packageId: "turbo",
    purchaseId: "p-g",
    externalSponsorId: null,
  });
  const replay = await createIdsForPurchase(sql, {
    userId: "u-g",
    packageId: "turbo",
    purchaseId: "p-g",
    externalSponsorId: null,
  });
  assert.deepEqual(replay.ids.slice().sort(), created.ids.slice().sort());
  assert.equal(replay.rootId, created.rootId);
  const ids = await sql<{ n: number }>`select count(*)::int as n from member_ids where purchase_id = ${"p-g"}`;
  const sponsors = await sql<{ n: number }>`
    select count(*)::int as n from sponsor_relationships sr
    join member_ids m on m.id = sr.sponsored_id where m.purchase_id = ${"p-g"}`;
  const placements = await sql<{ n: number }>`
    select count(*)::int as n from placement_relationships pr
    join member_ids m on m.id = pr.child_id where m.purchase_id = ${"p-g"}`;
  const events = await sql<{ n: number }>`
    select count(*)::int as n from membership_activation_events e
    join member_ids m on m.id = e.member_id where m.purchase_id = ${"p-g"}`;
  const comms = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries where beneficiary_id = ${created.rootId}`;
  assert.equal(ids[0]!.n, 4);
  assert.equal(sponsors[0]!.n, 3);
  assert.equal(placements[0]!.n, 3);
  assert.equal(events[0]!.n, 4);
  assert.equal(comms[0]!.n, 3);

  const req = await submitPaymentRequest(sql, {
    userId: "u-g",
    packageId: "builder",
    method: "CASH",
    submittedAmountBdt: 11000,
  });
  const first = await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
  const second = await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
  assert.equal(first.replayed, false);
  assert.equal(second.replayed, true);
  assert.equal(first.purchaseId, second.purchaseId);
  assert.equal(first.ids.length, 1);
  const purchases = await sql<{ n: number }>`select count(*)::int as n from package_purchases where user_id = ${"u-g"}`;
  assert.equal(purchases[0]!.n, 1);
});

test("H. PARTIAL FAILURE: mid-create throw rolls back; retry yields one complete Turbo", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-h", "Partial");
  await assert.rejects(
    () =>
      createIdsForPurchase(sql, {
        userId: "u-h",
        packageId: "turbo",
        purchaseId: "p-h",
        externalSponsorId: null,
        failAfterCreated: 2,
      }),
    /PACKAGE_TEST_FAILURE/,
  );
  const leftoverIds = await sql<{ n: number }>`select count(*)::int as n from member_ids where purchase_id = ${"p-h"}`;
  const leftoverSponsors = await sql<{ n: number }>`select count(*)::int as n from sponsor_relationships`;
  const leftoverEvents = await sql<{ n: number }>`select count(*)::int as n from membership_activation_events`;
  const leftoverComm = await sql<{ n: number }>`select count(*)::int as n from commission_entries`;
  assert.equal(leftoverIds[0]!.n, 0);
  assert.equal(leftoverSponsors[0]!.n, 0);
  assert.equal(leftoverEvents[0]!.n, 0);
  assert.equal(leftoverComm[0]!.n, 0);
  const retry = await createIdsForPurchase(sql, {
    userId: "u-h",
    packageId: "turbo",
    purchaseId: "p-h",
    externalSponsorId: null,
  });
  assert.equal(retry.ids.length, 4);
  const ids = await sql<{ n: number }>`select count(*)::int as n from member_ids where purchase_id = ${"p-h"}`;
  assert.equal(ids[0]!.n, 4);
  const l1 = await progress(sql, retry.rootId, 1);
  assert.equal(l1.status, "RELEASED");
});

test("I. WRONG REFERRAL: fails before any package or ID rows", async () => {
  const sql = await makeSql();
  await configureMethods(sql);
  await insertUser(sql, "u-i", "Invalid ref");
  await assert.rejects(
    () =>
      submitPaymentRequest(sql, {
        userId: "u-i",
        packageId: "turbo",
        method: "CASH",
        submittedAmountBdt: 44000,
        referralCode: "NOPE99",
      }),
    /Invalid referral code/,
  );
  assert.equal((await sql<{ n: number }>`select count(*)::int as n from payment_requests`)[0]!.n, 0);
  assert.equal((await sql<{ n: number }>`select count(*)::int as n from package_purchases`)[0]!.n, 0);
  assert.equal((await sql<{ n: number }>`select count(*)::int as n from member_ids`)[0]!.n, 0);

  await sql`
    insert into payment_requests (
      id, user_id, package_id, expected_amount_bdt, submitted_amount_bdt,
      payment_method, extra, status, referral_code
    ) values (
      ${"pay-bad"}, ${"u-i"}, ${"builder"}, ${11000}, ${11000},
      ${"CASH"}, ${"{}" }::jsonb, ${"PENDING"}, ${"NOPE99"}
    )
  `;
  await assert.rejects(
    () => approvePayment(sql, { requestId: "pay-bad", adminUserId: "admin1" }),
    /Invalid referral code/,
  );
  assert.equal((await sql<{ n: number }>`select count(*)::int as n from member_ids`)[0]!.n, 0);
  assert.equal((await sql<{ n: number }>`select count(*)::int as n from package_purchases`)[0]!.n, 0);
  const stillPending = await sql<{ status: string }>`select status from payment_requests where id = ${"pay-bad"}`;
  assert.equal(stillPending[0]!.status, "PENDING");
});

test("J. CYCLE SAFETY: package trees are acyclic; attaching a descendant as sponsor is rejected", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-j", "Cycle");
  const created = await createIdsForPurchase(sql, {
    userId: "u-j",
    packageId: "hyper_turbo",
    purchaseId: "p-j",
    externalSponsorId: null,
  });
  await assertNoSponsorCycle(sql, created.ids);
  const child = created.ids[1]!;
  assert.equal(await wouldCreateSponsorCycle(sql, created.rootId, child), true);
  await assert.rejects(() => assertAcyclicSponsor(sql, created.rootId, child), /cycle/i);
  await assert.rejects(() => assertAcyclicSponsor(sql, created.rootId, created.rootId), /cycle/i);
});

test("K. COUNTS: Builder=1 Turbo=4 Super=13 Hyper=22 exactly", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-k", "Counts");
  for (const [packageId, expected] of Object.entries(PACKAGE_COUNTS) as [PackageId, number][]) {
    assert.equal(PACKAGES[packageId].idCount, expected);
    assert.equal(planPackagePlacement(packageId).length, expected);
    const created = await createIdsForPurchase(sql, {
      userId: "u-k",
      packageId,
      purchaseId: `p-k-${packageId}`,
      externalSponsorId: null,
    });
    assert.equal(created.ids.length, expected);
    const n = await sql<{ n: number }>`
      select count(*)::int as n from member_ids where purchase_id = ${"p-k-" + packageId}`;
    assert.equal(n[0]!.n, expected);
  }
});

test("L. CORE ENGINE SEPARATION: planner does not write progress/commission rows", async () => {
  const processSrc = readFileSync(join(ROOT, "src/lib/engine/process.ts"), "utf8");
  const placementSrc = readFileSync(join(ROOT, "src/lib/engine/placement.ts"), "utf8");
  for (const src of [processSrc, placementSrc]) {
    assert.equal(/insert into commission_entries/i.test(src), false);
    assert.equal(/insert into level_progress/i.test(src), false);
    assert.equal(/insert into membership_activation_events/i.test(src), false);
    assert.equal(/insert into membership_activation_impacts/i.test(src), false);
    assert.equal(/insert into held_commissions/i.test(src), false);
    assert.equal(/insert into wallet_transactions/i.test(src), false);
  }
  assert.match(processSrc, /processNewId/);
  const sql = await makeSql();
  await insertUser(sql, "u-l", "Sep");
  const created = await createIdsForPurchase(sql, {
    userId: "u-l",
    packageId: "super_turbo",
    purchaseId: "p-l",
    externalSponsorId: null,
  });
  const events = await sql<{ n: number }>`
    select count(*)::int as n from membership_activation_events e
    join member_ids m on m.id = e.member_id where m.purchase_id = ${"p-l"}`;
  assert.equal(events[0]!.n, 13);
  const orphans = await sql<{ n: number }>`
    select count(*)::int as n from commission_entries c
    where not exists (
      select 1 from membership_activation_impacts i where i.commission_entry_id = c.id
    )`;
  assert.equal(orphans[0]!.n, 0);
  const levels = await sql<{ n: number }>`
    select count(*)::int as n from level_progress lp
    join member_ids m on m.id = lp.member_id where m.purchase_id = ${"p-l"}`;
  assert.equal(levels[0]!.n, 13 * 9);
});

test("financial sanity: package-triggered HELD/RELEASED vs locked prices", async () => {
  const sql = await makeSql();
  await insertUser(sql, "u-fb", "Fin builder");
  await insertUser(sql, "u-ft", "Fin turbo");
  await insertUser(sql, "u-fs", "Fin super");
  await insertUser(sql, "u-fh", "Fin hyper");

  async function freshSponsor(tag: string) {
    const userId = `u-x-${tag}`;
    await insertUser(sql, userId, `Sponsor ${tag}`);
    return createIdsForPurchase(sql, {
      userId,
      packageId: "builder",
      purchaseId: `p-x-${tag}`,
      externalSponsorId: null,
    });
  }

  const xb = await freshSponsor("b");
  const builder = await createIdsForPurchase(sql, {
    userId: "u-fb",
    packageId: "builder",
    purchaseId: "p-fb",
    externalSponsorId: xb.rootId,
  });
  const builderInternal = await commissionTotals(sql, builder.rootId);
  assert.equal(builderInternal.HELD.amt + builderInternal.RELEASED.amt, 0);
  const xbTot = await commissionTotals(sql, xb.rootId);
  assert.equal(xbTot.HELD.amt, 880);
  assert.equal(xbTot.RELEASED.amt, 0);

  const xt = await freshSponsor("t");
  const turbo = await createIdsForPurchase(sql, {
    userId: "u-ft",
    packageId: "turbo",
    purchaseId: "p-ft",
    externalSponsorId: xt.rootId,
  });
  const turboRoot = await commissionTotals(sql, turbo.rootId);
  assert.equal(turboRoot.RELEASED.amt, 2640);
  assert.equal(turboRoot.HELD.amt, 0);
  assert.equal((await wallet(sql, turbo.rootId)).available, 2640);
  const xtTot = await commissionTotals(sql, xt.rootId);
  assert.equal(xtTot.HELD.amt, 880);
  assert.equal((await progress(sql, xt.rootId, 1)).completed_members, 1);
  assert.ok(2640 < PACKAGES.turbo.amountBdt);

  const xs = await freshSponsor("s");
  const superT = await createIdsForPurchase(sql, {
    userId: "u-fs",
    packageId: "super_turbo",
    purchaseId: "p-fs",
    externalSponsorId: xs.rootId,
  });
  const superRoot = await commissionTotals(sql, superT.rootId);
  assert.equal(superRoot.RELEASED.amt, 2640 + 5940);
  assert.equal(superRoot.HELD.amt, 0);
  let superInternalReleased = superRoot.RELEASED.amt;
  for (const id of superT.ids.slice(1, 4)) {
    const tot = await commissionTotals(sql, id);
    assert.equal(tot.RELEASED.amt, 2640);
    superInternalReleased += tot.RELEASED.amt;
  }
  assert.equal(superInternalReleased, 16500);
  const xsTot = await commissionTotals(sql, xs.rootId);
  assert.equal(xsTot.HELD.amt, 880);
  assert.ok(16500 < PACKAGES.super_turbo.amountBdt);

  const xh = await freshSponsor("h");
  const hyper = await createIdsForPurchase(sql, {
    userId: "u-fh",
    packageId: "hyper_turbo",
    purchaseId: "p-fh",
    externalSponsorId: xh.rootId,
  });
  const hyperRoot = await commissionTotals(sql, hyper.rootId);
  assert.equal(hyperRoot.RELEASED.amt, 8580);
  assert.equal(hyperRoot.HELD.amt, 2970);
  const hyperRootL3 = await progress(sql, hyper.rootId, 3);
  assert.equal(hyperRootL3.completed_members, 9);
  assert.equal(hyperRootL3.status, "IN_PROGRESS");
  let hyperReleased = hyperRoot.RELEASED.amt;
  let hyperHeld = hyperRoot.HELD.amt;
  for (const id of [hyper.ids[1]!, hyper.ids[2]!, hyper.ids[3]!]) {
    const tot = await commissionTotals(sql, id);
    assert.equal(tot.RELEASED.amt, 2640);
    assert.equal(tot.HELD.amt, 1980);
    hyperReleased += tot.RELEASED.amt;
    hyperHeld += tot.HELD.amt;
  }
  for (const id of [hyper.ids[5]!, hyper.ids[8]!, hyper.ids[11]!]) {
    const tot = await commissionTotals(sql, id);
    assert.equal(tot.RELEASED.amt, 2640);
    hyperReleased += tot.RELEASED.amt;
  }
  assert.equal(hyperReleased, 24420);
  assert.equal(hyperHeld, 8910);
  assert.equal(hyperReleased + hyperHeld, 33330);
  const xhTot = await commissionTotals(sql, xh.rootId);
  assert.equal(xhTot.HELD.amt, 880);
  assert.equal((await progress(sql, xh.rootId, 1)).completed_members, 1);
  assert.ok(33330 < PACKAGES.hyper_turbo.amountBdt);
});

test("payment submit does not create IDs; approve is the production trigger", async () => {
  const sql = await makeSql();
  await configureMethods(sql);
  await insertUser(sql, "u-pay", "Pay");
  const req = await submitPaymentRequest(sql, {
    userId: "u-pay",
    packageId: "super_turbo",
    method: "BKASH",
    submittedAmountBdt: 143000,
    transactionReference: "BK-ST-1",
  });
  assert.equal(req.status, "PENDING");
  assert.equal((await sql<{ n: number }>`select count(*)::int as n from member_ids`)[0]!.n, 0);
  const approved = await approvePayment(sql, { requestId: req.id, adminUserId: "admin1" });
  assert.equal(approved.ids.length, 13);
  const a = approved.ids[1]!;
  assert.equal((await progress(sql, approved.rootId, 1)).status, "RELEASED");
  assert.equal((await progress(sql, a, 1)).status, "RELEASED");
});
