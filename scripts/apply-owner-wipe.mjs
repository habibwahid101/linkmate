/**
 * Owner-ordered fresh start.
 * Keeps the two admin logins, packages, commission rates, and app settings.
 * Deletes every membership, wallet, commission, sponsor, and placement row.
 *
 *   CONFIRM=LINKMATE-RESET-TEST-BUSINESS node scripts/apply-owner-wipe.mjs
 */
import pg from "pg";

const KEEP = ["hello.habibwahid@gmail.com", "linkmateglobal@gmail.com"];
if (process.env.CONFIRM !== "LINKMATE-RESET-TEST-BUSINESS") {
  console.error("Refusing: CONFIRM token missing");
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

function n(result) {
  return Number(result.rowCount ?? 0);
}

async function exists(table) {
  const result = await client.query("select to_regclass($1) as name", [`public.${table}`]);
  return Boolean(result.rows[0]?.name);
}

try {
  const admins = await client.query(
    `select lower(email) as email from app_users where role = 'admin'`,
  );
  const emails = admins.rows.map((row) => String(row.email || ""));
  if (admins.rows.length !== 2 || KEEP.some((email) => !emails.includes(email)) || emails.some((email) => !KEEP.includes(email))) {
    throw new Error("Refusing wipe: admin set is not exactly the two kept accounts");
  }

  await client.query("begin");
  const deleted = {};
  const tables = [
    "wallet_transactions",
    "withdrawal_requests",
    "held_commissions",
    "commission_entries",
    "level_progress",
    "generation_memberships",
    "membership_activation_impacts",
    "membership_activation_events",
    "placement_relationships",
    "sponsor_relationships",
    "sponsor_designation_credits",
    "notifications",
    "payment_requests",
    "payments",
    "user_packages",
    "package_purchases",
    "purchase_idempotency",
    "wallets",
    "member_ids",
  ];
  for (const table of tables) {
    if (!(await exists(table))) {
      deleted[table] = 0;
      continue;
    }
    deleted[table] = n(await client.query(`delete from ${table}`));
  }

  const dropUsers = await client.query(
    `select user_id from app_users where coalesce(lower(email), '') <> all($1::text[])`,
    [KEEP],
  );
  const dropIds = dropUsers.rows.map((row) => row.user_id);
  if (dropIds.length) {
    if (await exists("session")) {
      await client.query(`delete from "session" where "userId" = any($1::text[])`, [dropIds]);
    }
    if (await exists("account")) {
      await client.query(`delete from "account" where "userId" = any($1::text[])`, [dropIds]);
    }
    await client.query(`delete from app_users where user_id = any($1::text[])`, [dropIds]);
    if (await exists("user")) {
      await client.query(`delete from "user" where id = any($1::text[])`, [dropIds]);
    }
  }
  if (await exists("user")) {
    await client.query(`delete from "user" where lower(email) <> all($1::text[])`, [KEEP]);
  }
  await client.query(
    `update app_users
     set active_id = null, intended_referral_code = null, intended_sponsor_user_id = null
     where lower(email) = any($1::text[])`,
    [KEEP],
  );
  await client.query(`alter sequence if exists member_id_seq restart with 100001`);
  await client.query(
    `insert into app_settings (key, value, updated_at)
     values ('batch1_test_reset_at', $1, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [new Date().toISOString()],
  );

  const afterAdmins = await client.query(`select count(*)::int as n from app_users where role = 'admin'`);
  const afterMembers = await client.query(`select count(*)::int as n from member_ids`);
  const afterUsers = await client.query(`select count(*)::int as n from app_users where role <> 'admin'`);
  const cutover = await client.query(
    `select value from app_settings where key = 'placement_rules_cutover_at'`,
  );
  if (Number(afterAdmins.rows[0].n) !== 2 || Number(afterMembers.rows[0].n) !== 0 || Number(afterUsers.rows[0].n) !== 0) {
    throw new Error("Wipe check failed");
  }
  if (!String(cutover.rows[0]?.value ?? "").trim()) throw new Error("Cutover was cleared");
  await client.query("commit");
  console.log(
    JSON.stringify({
      ok: true,
      dropped_users: dropIds.length,
      member_ids: 0,
      admin_count: 2,
      cutover: cutover.rows[0].value,
      deleted,
    }),
  );
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    /* no open transaction */
  }
  console.error(error instanceof Error ? error.message : "wipe failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
