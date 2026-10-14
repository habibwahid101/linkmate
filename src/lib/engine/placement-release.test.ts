import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { settleOpenPlacementLevel, type PlacementReleaseFailAt, type Sql } from "./activation.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function tagged(queryable: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }): Sql {
  return (async <T>(strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i += 1) text += `$${i + 1}${strings[i + 1] ?? ""}`;
    const result = await queryable.query(text, values);
    return result.rows as T[];
  }) as Sql;
}

function makeSql(pg: PGlite): Sql {
  const sql = tagged(pg);
  sql.withTransaction = async (fn) =>
    pg.transaction(async (tx) => {
      const inner = tagged(tx as { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> });
      inner.withTransaction = async (nested) => nested(inner);
      return fn(inner);
    });
  return sql;
}

async function apply(pg: PGlite) {
  for (const file of [
    "migrations/0002_schema.sql",
    "migrations/0003_hardening.sql",
    "migrations/0010_id_based_engine.sql",
    "migrations/0012_sponsor_designations.sql",
    "migrations/0013_placement_cutover_prep.sql",
  ]) {
    await pg.exec(readFileSync(join(ROOT, file), "utf8"));
  }
}

async function seed(sql: Sql, opts: { cutover?: boolean; placementCount?: number } = {}) {
  const placementCount = opts.placementCount ?? 3;
  await sql`
    insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values ('u-m', 'Member', 'm@lm.test', 'member', 'MEM001', false)
  `;
  await sql`
    insert into member_ids (
      id, owner_user_id, package_id, is_root, placement_status, joining_amount_bdt,
      current_level, progression_status
    ) values ('LM-1', 'u-m', 'builder', true, 'placed', 11000, 1, 'ACTIVE')
  `;
  await sql`
    insert into wallets (member_id, owner_user_id, available_balance, total_released)
    values ('LM-1', 'u-m', 0, 0)
  `;
  await sql`
    insert into level_progress (
      id, member_id, level, generation, required_members, completed_members,
      placement_completed_members, remaining_members, accumulated_commission,
      expected_full_commission, status
    ) values
      ('lp1', 'LM-1', 1, 1, 3, 2, ${placementCount}, 1, 4400, 2640, 'IN_PROGRESS'),
      ('lp2', 'LM-1', 2, 2, 9, 0, 0, 9, 0, 5940, 'LOCKED')
  `;
  await sql`
    insert into held_commissions (member_id, owner_user_id, level, amount)
    values ('LM-1', 'u-m', 1, 4400)
  `;
  const rows = [
    ["c1", "e1", "LM-A", "sponsor"],
    ["c2", "e2", "LM-B", "sponsor"],
    ["c3", "e3", "LM-C", "placement"],
    ["c4", "e4", "LM-D", "placement"],
    ["c5", "e5", "LM-E", "placement"],
  ] as const;
  for (const [id, eventId, sourceId, model] of rows) {
    await sql`
      insert into commission_entries (
        id, event_id, beneficiary_user_id, beneficiary_id, source_user_id, source_id,
        source_joining_amount, generation, level, commission_rate, commission_amount,
        status, rule_version, ancestry_model
      ) values (
        ${id}, ${eventId}, 'u-m', 'LM-1', 'u-src', ${sourceId},
        11000, 1, 1, 0.08, 880, 'HELD', 1, ${model}
      )
    `;
  }
  if (opts.cutover) {
    await sql`
      insert into app_settings (key, value)
      values ('placement_rules_cutover_at', '2000-01-01T00:00:00.000Z')
      on conflict (key) do update set value = excluded.value
    `;
  }
}

async function snapshot(sql: Sql) {
  const commissions = await sql<{
    id: string;
    commission_amount: number;
    status: string;
    ancestry_model: string;
    wallet_transaction_id: string | null;
  }>`
    select id, commission_amount, status, ancestry_model, wallet_transaction_id
    from commission_entries order by id
  `;
  const held = await sql<{ amount: number }>`
    select amount from held_commissions where member_id = 'LM-1' and level = 1
  `;
  const wallet = await sql<{ available_balance: number; total_released: number }>`
    select available_balance, total_released from wallets where member_id = 'LM-1'
  `;
  const txs = await sql<{ id: string; amount: number }>`
    select id, amount from wallet_transactions where member_id = 'LM-1' order by id
  `;
  const progress = await sql<{
    level: number;
    completed_members: number;
    placement_completed_members: number;
    status: string;
  }>`
    select level, completed_members, placement_completed_members, status
    from level_progress where member_id = 'LM-1' order by level
  `;
  const member = await sql<{ current_level: number }>`
    select current_level from member_ids where id = 'LM-1'
  `;
  return {
    commissions: commissions.map((r) => ({
      id: r.id,
      amount: Number(r.commission_amount),
      status: r.status,
      model: r.ancestry_model,
      tx: r.wallet_transaction_id,
    })),
    held: Number(held[0]?.amount ?? 0),
    available: Number(wallet[0]?.available_balance ?? 0),
    released: Number(wallet[0]?.total_released ?? 0),
    txs: txs.map((r) => ({ id: r.id, amount: Number(r.amount) })),
    progress: progress.map((r) => ({
      level: Number(r.level),
      completed: Number(r.completed_members),
      placement: Number(r.placement_completed_members),
      status: r.status,
    })),
    currentLevel: Number(member[0]?.current_level ?? 0),
  };
}

function assertStart(state: Awaited<ReturnType<typeof snapshot>>) {
  assert.equal(state.held, 4400);
  assert.equal(state.available, 0);
  assert.equal(state.released, 0);
  assert.equal(state.txs.length, 0);
  assert.equal(state.currentLevel, 1);
  assert.equal(state.progress[0]?.completed, 2);
  assert.equal(state.progress[0]?.status, "IN_PROGRESS");
  assert.equal(state.commissions.every((r) => r.status === "HELD" && r.amount === 880 && r.tx == null), true);
}

function assertSettled(state: Awaited<ReturnType<typeof snapshot>>) {
  assert.equal(state.held, 0);
  assert.equal(state.available, 4400);
  assert.equal(state.released, 4400);
  assert.deepEqual(state.txs, [
    { id: "legacy-release:LM-1:1", amount: 1760 },
    { id: "release:LM-1:1:placement", amount: 2640 },
  ]);
  assert.equal(state.currentLevel, 2);
  assert.equal(state.progress[0]?.completed, 2);
  assert.equal(state.progress[0]?.placement, 3);
  assert.equal(state.progress[0]?.status, "RELEASED");
  assert.equal(state.progress[1]?.status, "IN_PROGRESS");
  assert.equal(state.progress[1]?.completed, 0);
  for (const row of state.commissions) {
    assert.equal(row.amount, 880);
    assert.equal(row.status, "RELEASED");
    assert.equal(row.tx, row.model === "placement" ? "release:LM-1:1:placement" : "legacy-release:LM-1:1");
  }
}

async function fresh() {
  const pg = new PGlite();
  await pg.waitReady;
  await apply(pg);
  return makeSql(pg);
}

test("cutover empty does not release either cohort", async () => {
  const sql = await fresh();
  await seed(sql, { cutover: false, placementCount: 3 });
  const result = await settleOpenPlacementLevel(sql, "LM-1", 1);
  assert.equal(result.released, false);
  assertStart(await snapshot(sql));
});

test("placement counter below the requirement writes nothing", async () => {
  const sql = await fresh();
  await seed(sql, { cutover: true, placementCount: 2 });
  const result = await settleOpenPlacementLevel(sql, "LM-1", 1);
  assert.equal(result.released, false);
  assertStart(await snapshot(sql));
});

test("S-Wait posts 2640 and 1760 once, then a retry adds nothing", async () => {
  const sql = await fresh();
  await seed(sql, { cutover: true });
  const first = await settleOpenPlacementLevel(sql, "LM-1", 1);
  assert.equal(first.released, true);
  assertSettled(await snapshot(sql));
  const second = await settleOpenPlacementLevel(sql, "LM-1", 1);
  assert.equal(second.released, false);
  assertSettled(await snapshot(sql));
});

test("two overlapping calls leave one pair of wallet rows", async () => {
  const sql = await fresh();
  await seed(sql, { cutover: true });
  const results = await Promise.all([
    settleOpenPlacementLevel(sql, "LM-1", 1),
    settleOpenPlacementLevel(sql, "LM-1", 1),
  ]);
  assert.equal(results.filter((r) => r.released).length, 1);
  assertSettled(await snapshot(sql));
});

for (const failAt of [
  "before-placement-claim",
  "after-placement-claim",
  "after-placement-wallet",
  "before-legacy-wallet",
  "reconcile",
  "advance",
] as const) {
  test(`throw at ${failAt} rolls the whole release back, then one retry settles`, async () => {
    const sql = await fresh();
    await seed(sql, { cutover: true });
    await assert.rejects(
      () => settleOpenPlacementLevel(sql, "LM-1", 1, { failAt: failAt satisfies PlacementReleaseFailAt }),
      /RELEASE_TEST_FAILURE/,
    );
    assertStart(await snapshot(sql));
    const retry = await settleOpenPlacementLevel(sql, "LM-1", 1);
    assert.equal(retry.released, true);
    assertSettled(await snapshot(sql));
  });
}
