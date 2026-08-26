import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pendingMigrations } from "../../scripts/migration-plan.mjs";
import { DURABLE_TABLES } from "../../scripts/durable-tables.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const MIGRATIONS_DIR = join(ROOT, "migrations");

const LEDGER_TABLES = [
  "app_users",
  "member_ids",
  "package_purchases",
  "payments",
  "sponsor_relationships",
  "placement_relationships",
  "generation_memberships",
  "level_progress",
  "commission_entries",
  "held_commissions",
  "wallets",
  "wallet_transactions",
  "audit_logs",
  "app_settings",
  "payment_method_settings",
  "payment_requests",
];

function migrationFiles(): Array<{ name: string; sql: string }> {
  const names = readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith(".sql"));
  return pendingMigrations(names, []).map(({ name }) => ({
    name,
    sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8"),
  }));
}

async function applyAll(pg: PGlite) {
  await pg.exec(
    "create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  for (const file of migrationFiles()) {
    await pg.transaction(async (tx) => {
      await tx.exec(file.sql);
      await tx.query("insert into _migrations (name) values ($1)", [file.name]);
    });
  }
}

describe("migration safety", () => {
  it("does not drop, truncate, or recreate production data", () => {
    for (const file of migrationFiles()) {
      const body = file.sql.replace(/--.*$/gm, "");
      assert.equal(/\bdrop\s+table\b/i.test(body), false, `${file.name} drops tables`);
      assert.equal(/\btruncate\b/i.test(body), false, `${file.name} truncates`);
      assert.equal(/\bdrop\s+schema\b/i.test(body), false, `${file.name} drops schema`);
    }
  });

  it("applies cleanly then leaves populated ledger rows after a second apply", async () => {
    const pg = new PGlite();
    await pg.waitReady;
    await applyAll(pg);

    await pg.query(
      `insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
       values ('u-restore', 'Restore', 'restore@lm.test', 'member', 'RSTR01', false)`,
    );
    await pg.query(
      `insert into member_ids (id, owner_user_id, package_id, is_root, placement_status, joining_amount_bdt)
       values ('LM-100001', 'u-restore', 'builder', true, 'placed', 11000)`,
    );
    await pg.query(
      `insert into wallets (member_id, owner_user_id, available_balance, total_released)
       values ('LM-100001', 'u-restore', 880, 880)`,
    );
    await pg.query(
      `insert into wallet_transactions (id, member_id, owner_user_id, type, amount, source, status)
       values ('tx-1', 'LM-100001', 'u-restore', 'COMMISSION', 880, 'release', 'posted')`,
    );
    await pg.query(
      `insert into commission_entries (
         id, event_id, beneficiary_user_id, beneficiary_id, source_user_id, source_id,
         source_joining_amount, generation, level, commission_rate, commission_amount, status, rule_version
       ) values (
         'ce-1', 'evt-1', 'u-restore', 'LM-100001', 'u-src', 'LM-100002',
         11000, 1, 1, 0.0800, 880, 'RELEASED', 1
       )`,
    );
    await pg.query(
      `insert into held_commissions (member_id, owner_user_id, level, amount)
       values ('LM-100001', 'u-restore', 2, 660)`,
    );
    await pg.query(
      `insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
       values ('aud-1', 'u-restore', 'test.restore', 'wallets', 'LM-100001', 'seed')`,
    );

    const before = await pg.query<{ n: number }>(
      "select count(*)::int as n from commission_entries",
    );
    assert.equal(before.rows[0]?.n, 1);

    const applied = (await pg.query<{ name: string }>("select name from _migrations")).rows.map(
      (r) => r.name,
    );
    const pending = pendingMigrations(
      readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith(".sql")),
      applied,
    );
    assert.equal(pending.length, 0);

    const after = await pg.query<{ n: number }>("select count(*)::int as n from commission_entries");
    assert.equal(after.rows[0]?.n, 1);
    const wallet = await pg.query<{ available_balance: number }>(
      "select available_balance from wallets where member_id = 'LM-100001'",
    );
    assert.equal(Number(wallet.rows[0]?.available_balance), 880);
    const user = await pg.query<{ user_id: string }>(
      "select user_id from app_users where user_id = 'u-restore'",
    );
    assert.equal(user.rows[0]?.user_id, "u-restore");

    for (const table of LEDGER_TABLES) {
      const exists = await pg.query<{ exists: boolean }>(
        "select to_regclass($1) is not null as exists",
        [table],
      );
      assert.equal(exists.rows[0]?.exists, true, `${table} missing`);
    }
  });

  it("export inventory includes auth, ledger, wallet, and audit tables", () => {
    for (const table of [
      "user",
      "session",
      "account",
      "verification",
      "app_users",
      "member_ids",
      "sponsor_relationships",
      "placement_relationships",
      "generation_memberships",
      "level_progress",
      "commission_entries",
      "held_commissions",
      "wallets",
      "wallet_transactions",
      "package_purchases",
      "payments",
      "audit_logs",
    ]) {
      assert.equal(DURABLE_TABLES.includes(table), true, `${table} missing from export inventory`);
    }
  });

  it("can restore a JSON ledger snapshot into a fresh isolated database", async () => {
    const source = new PGlite();
    await source.waitReady;
    await applyAll(source);
    await source.query(
      `insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
       values ('u-snap', 'Snap', 'snap@lm.test', 'member', 'SNAP01', false)`,
    );
    await source.query(
      `insert into member_ids (id, owner_user_id, package_id, is_root, placement_status, joining_amount_bdt)
       values ('LM-200001', 'u-snap', 'builder', true, 'placed', 11000)`,
    );
    const users = (
      await source.query<{
        user_id: string;
        display_name: string;
        email: string;
        role: string;
        referral_code: string;
        is_synthetic: boolean;
      }>("select user_id, display_name, email, role, referral_code, is_synthetic from app_users")
    ).rows;
    const ids = (
      await source.query<{
        id: string;
        owner_user_id: string;
        package_id: string;
        is_root: boolean;
        placement_status: string;
        joining_amount_bdt: number;
      }>(
        "select id, owner_user_id, package_id, is_root, placement_status, joining_amount_bdt from member_ids",
      )
    ).rows;

    const target = new PGlite();
    await target.waitReady;
    await applyAll(target);
    for (const row of users) {
      await target.query(
        `insert into app_users (user_id, display_name, email, role, referral_code, is_synthetic)
         values ($1, $2, $3, $4, $5, $6)`,
        [row.user_id, row.display_name, row.email, row.role, row.referral_code, row.is_synthetic],
      );
    }
    for (const row of ids) {
      await target.query(
        `insert into member_ids (id, owner_user_id, package_id, is_root, placement_status, joining_amount_bdt)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          row.id,
          row.owner_user_id,
          row.package_id,
          row.is_root,
          row.placement_status,
          row.joining_amount_bdt,
        ],
      );
    }
    const restoredUsers = await target.query<{ n: number }>(
      "select count(*)::int as n from app_users where user_id = 'u-snap'",
    );
    const restoredIds = await target.query<{ n: number }>(
      "select count(*)::int as n from member_ids where id = 'LM-200001'",
    );
    assert.equal(restoredUsers.rows[0]?.n, 1);
    assert.equal(restoredIds.rows[0]?.n, 1);
  });
});
