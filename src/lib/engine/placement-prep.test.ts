import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

async function applyThrough(pg: PGlite, files: string[]) {
  for (const file of files) {
    await pg.exec(readFileSync(join(ROOT, file), "utf8"));
  }
}

test("0013 labels existing rows and does not change financial amounts", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  await applyThrough(pg, [
    "migrations/0002_schema.sql",
    "migrations/0003_hardening.sql",
    "migrations/0010_id_based_engine.sql",
    "migrations/0012_sponsor_designations.sql",
  ]);

  await pg.exec(`
    insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
    values ('u-old', 'Old', 'old@lm.test', 'member', 'OLD001', false);
    insert into member_ids (
      id, owner_user_id, package_id, is_root, placement_status, joining_amount_bdt, current_level
    ) values ('LM-1', 'u-old', 'builder', true, 'placed', 11000, 1);
    insert into wallets (member_id, owner_user_id, available_balance, total_released)
    values ('LM-1', 'u-old', 1760, 0);
    insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
    values ('tx-old', 'LM-1', 'u-old', 'RELEASE', 0, 'none', 'posted');
    insert into commission_entries (
      id, event_id, beneficiary_user_id, beneficiary_id, source_user_id, source_id,
      source_joining_amount, generation, level, commission_rate, commission_amount, status, rule_version
    ) values
      ('c1', 'e1', 'u-old', 'LM-1', 'u-a', 'LM-A', 11000, 1, 1, 0.08, 880, 'HELD', 1),
      ('c2', 'e2', 'u-old', 'LM-1', 'u-b', 'LM-B', 11000, 1, 1, 0.08, 880, 'HELD', 1);
    insert into held_commissions (member_id, owner_user_id, level, amount)
    values ('LM-1', 'u-old', 1, 1760);
    insert into level_progress (
      id, member_id, level, generation, required_members, completed_members,
      remaining_members, accumulated_commission, expected_full_commission, status
    ) values (
      'lp1', 'LM-1', 1, 1, 3, 2, 1, 1760, 2640, 'IN_PROGRESS'
    );
    insert into membership_activation_events (id, member_id, owner_user_id, sponsor_id, joining_amount_bdt)
    values ('activate:LM-A', 'LM-A', 'u-a', 'LM-1', 11000);
  `);

  const sql = readFileSync(join(ROOT, "migrations/0013_placement_cutover_prep.sql"), "utf8");
  const body = sql.replace(/--.*$/gm, "");
  assert.equal(/\bupdate\s+commission_entries\b/i.test(body), false);
  assert.equal(/\bupdate\s+wallets\b/i.test(body), false);
  assert.equal(/\bupdate\s+wallet_transactions\b/i.test(body), false);
  assert.equal(/\bupdate\s+held_commissions\b/i.test(body), false);
  assert.equal(/\bupdate\s+level_progress\b/i.test(body), false);

  await pg.exec(sql);
  await pg.exec(sql);

  const commissions = await pg.query<{
    commission_amount: number;
    status: string;
    ancestry_model: string;
  }>("select commission_amount, status, ancestry_model from commission_entries order by id");
  assert.deepEqual(
    commissions.rows.map((r) => ({
      commission_amount: Number(r.commission_amount),
      status: r.status,
      ancestry_model: r.ancestry_model,
    })),
    [
      { commission_amount: 880, status: "HELD", ancestry_model: "sponsor" },
      { commission_amount: 880, status: "HELD", ancestry_model: "sponsor" },
    ],
  );

  const wallet = await pg.query<{ available_balance: number; total_released: number }>(
    "select available_balance, total_released from wallets where member_id = 'LM-1'",
  );
  assert.equal(Number(wallet.rows[0]?.available_balance), 1760);
  assert.equal(Number(wallet.rows[0]?.total_released), 0);

  const progress = await pg.query<{
    completed_members: number;
    placement_completed_members: number;
    status: string;
  }>(
    "select completed_members, placement_completed_members, status from level_progress where member_id = 'LM-1'",
  );
  assert.equal(Number(progress.rows[0]?.completed_members), 2);
  assert.equal(Number(progress.rows[0]?.placement_completed_members), 0);
  assert.equal(progress.rows[0]?.status, "IN_PROGRESS");

  const event = await pg.query<{ ancestry_model: string }>(
    "select ancestry_model from membership_activation_events where id = 'activate:LM-A'",
  );
  assert.equal(event.rows[0]?.ancestry_model, "sponsor");

  const setting = await pg.query<{ value: string }>(
    "select value from app_settings where key = 'placement_rules_cutover_at'",
  );
  assert.equal(setting.rows[0]?.value, "");

  const held = await pg.query<{ amount: number }>(
    "select amount from held_commissions where member_id = 'LM-1' and level = 1",
  );
  assert.equal(Number(held.rows[0]?.amount), 1760);
});
