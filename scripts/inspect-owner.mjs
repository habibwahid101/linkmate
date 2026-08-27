#!/usr/bin/env node
/**
 * Read-only production diagnostics for the owner account and schema.
 *   ADMIN_EMAIL=hello.habibwahid@gmail.com node scripts/inspect-owner.mjs
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
const email = (process.env.ADMIN_EMAIL || "hello.habibwahid@gmail.com").trim().toLowerCase();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

const EXPECTED_TABLES = [
  "app_users",
  "member_ids",
  "package_purchases",
  "wallets",
  "held_commissions",
  "level_progress",
  "sponsor_relationships",
  "generation_memberships",
  "wallet_transactions",
  "notifications",
  "audit_logs",
  "payment_requests",
  "withdrawal_requests",
  "app_settings",
];

try {
  const auth = await pool.query(`select id, email, name from "user" where lower(email) = $1`, [email]);
  console.log("AUTH_ROWS", auth.rowCount);
  for (const row of auth.rows) console.log("AUTH", row);

  const mapped = await pool.query(
    `select u.id as auth_id, u.email as auth_email, a.user_id, a.role, a.email as app_email, a.referral_code
     from "user" u
     left join app_users a on a.user_id = u.id
     where lower(u.email) = $1`,
    [email],
  );
  console.log("MAPPING", mapped.rows);

  const counts = await pool.query(
    `select count(*)::int as n from app_users a
     join "user" u on u.id = a.user_id
     where lower(u.email) = $1`,
    [email],
  );
  console.log("APP_USERS_FOR_EMAIL", counts.rows[0]?.n);

  const audit = await pool.query(
    `select action, detail, created_at from audit_logs
     where entity_type = 'app_users'
     order by created_at desc limit 5`,
  );
  console.log("AUDIT", audit.rows);

  const tables = await pool.query(
    `select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
  );
  const have = new Set(tables.rows.map((r) => r.table_name));
  const missing = EXPECTED_TABLES.filter((t) => !have.has(t));
  console.log("MISSING_TABLES", missing);

  const cols = await pool.query(
    `select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'app_users' order by ordinal_position`,
  );
  console.log("APP_USERS_COLUMNS", cols.rows.map((r) => r.column_name));

  const migrations = await pool.query(`select name from _migrations order by name`).catch(() => ({ rows: [] }));
  console.log("MIGRATIONS", migrations.rows.map((r) => r.name));

  const userId = auth.rows[0]?.id;
  if (userId) {
    const dash = await pool.query(
      `select
         (select count(*)::int from member_ids where owner_user_id = $1) as ids,
         (select count(*)::int from package_purchases where user_id = $1) as purchases,
         (select count(*)::int from notifications where user_id = $1) as notes,
         (select count(*)::int from wallet_transactions where owner_user_id = $1) as tx`,
      [userId],
    );
    console.log("DASHBOARD_COUNTS", dash.rows[0]);
  }
} finally {
  await pool.end();
}
