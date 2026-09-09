#!/usr/bin/env node
/**
 * One-time Batch 1 operator tool.
 * Inventory (default) or transactional reset of disposable test business data.
 *
 * Never a public endpoint. Never prints passwords/hashes/tokens.
 *
 *   DATABASE_URL=postgres://… node scripts/reset-test-business.mjs
 *   CONFIRM=LINKMATE-RESET-TEST-BUSINESS node scripts/reset-test-business.mjs --apply
 *
 * After a successful apply, app_settings.batch1_test_reset_at is set and a
 * second apply is refused unless FORCE=1.
 */
import pg from "pg";
import { pathToFileURL } from "node:url";

export const KEEP_ADMIN_EMAILS = ["hello.habibwahid@gmail.com", "linkmateglobal@gmail.com"];
export const CONFIRM_TOKEN = "LINKMATE-RESET-TEST-BUSINESS";

async function tableExists(client, name) {
  const r = await client.query("select to_regclass($1) as name", [`public.${name}`]);
  return Boolean(r.rows[0]?.name);
}

async function count(client, sql, params = []) {
  const r = await client.query(sql, params);
  return Number(r.rows[0]?.n ?? 0);
}

function affected(result) {
  const fromRows = Array.isArray(result.rows) ? result.rows.length : 0;
  const fromCount = Number(result.rowCount ?? 0);
  return Math.max(fromRows, fromCount);
}

export async function inventory(client) {
  const authUsers = await count(client, `select count(*)::int as n from "user"`);
  const admins = await client.query(
    `select a.user_id, a.email, a.role, a.is_synthetic, a.referral_code, a.active_id
     from app_users a
     where a.role = 'admin'
     order by a.email`,
  );
  const adminEmails = admins.rows.map((r) => String(r.email || "").toLowerCase()).filter(Boolean);
  const keepFound = KEEP_ADMIN_EMAILS.filter((e) => adminEmails.includes(e));
  const extraAdmins = adminEmails.filter((e) => !KEEP_ADMIN_EMAILS.includes(e));
  const missingAdmins = KEEP_ADMIN_EMAILS.filter((e) => !adminEmails.includes(e));

  const members = await client.query(
    `select user_id, email, role, is_synthetic, referral_code
     from app_users
     where role <> 'admin'
     order by created_at`,
  );
  const synthetic = members.rows.filter((r) => r.is_synthetic).length;

  const tables = {
    member_ids: await count(client, "select count(*)::int as n from member_ids"),
    package_purchases: await count(client, "select count(*)::int as n from package_purchases"),
    payments: (await tableExists(client, "payments"))
      ? await count(client, "select count(*)::int as n from payments")
      : 0,
    user_packages: (await tableExists(client, "user_packages"))
      ? await count(client, "select count(*)::int as n from user_packages")
      : 0,
    sponsor_relationships: await count(client, "select count(*)::int as n from sponsor_relationships"),
    placement_relationships: await count(client, "select count(*)::int as n from placement_relationships"),
    generation_memberships: await count(client, "select count(*)::int as n from generation_memberships"),
    level_progress: await count(client, "select count(*)::int as n from level_progress"),
    commission_entries: await count(client, "select count(*)::int as n from commission_entries"),
    held_commissions: await count(client, "select count(*)::int as n from held_commissions"),
    wallets: await count(client, "select count(*)::int as n from wallets"),
    wallet_transactions: await count(client, "select count(*)::int as n from wallet_transactions"),
    notifications: await count(client, "select count(*)::int as n from notifications"),
    payment_requests: (await tableExists(client, "payment_requests"))
      ? await count(client, "select count(*)::int as n from payment_requests")
      : 0,
    withdrawal_requests: (await tableExists(client, "withdrawal_requests"))
      ? await count(client, "select count(*)::int as n from withdrawal_requests")
      : 0,
    purchase_idempotency: (await tableExists(client, "purchase_idempotency"))
      ? await count(client, "select count(*)::int as n from purchase_idempotency")
      : 0,
    audit_logs: await count(client, "select count(*)::int as n from audit_logs"),
    packages: await count(client, "select count(*)::int as n from packages"),
    commission_rules: await count(client, "select count(*)::int as n from commission_rules"),
    app_settings: await count(client, "select count(*)::int as n from app_settings"),
  };

  const joining = await client.query(
    `select coalesce(sum(amount_bdt),0)::int as v, coalesce(sum(id_count),0)::int as ids from package_purchases`,
  );
  const paymentMix = (await tableExists(client, "payment_requests"))
    ? (
        await client.query(
          `select payment_method, status, count(*)::int as n
           from payment_requests group by 1, 2 order by 1, 2`,
        )
      ).rows
    : [];
  const approvedDigital = (await tableExists(client, "payment_requests"))
    ? (
        await client.query(
          `select pr.payment_method, pr.status, a.email, a.is_synthetic, pr.expected_amount_bdt
           from payment_requests pr
           join app_users a on a.user_id = pr.user_id
           where pr.status = 'APPROVED'
             and pr.payment_method in ('BKASH','NAGAD','BANK')
           order by pr.created_at`,
        )
      ).rows
    : [];

  const suspiciousReal = approvedDigital.filter((r) => {
    const email = String(r.email || "").toLowerCase();
    return !KEEP_ADMIN_EMAILS.includes(email) && r.is_synthetic !== true;
  });

  const already = await client.query(
    `select value from app_settings where key = 'batch1_test_reset_at'`,
  );

  const blockers = [];
  if (affected(admins) !== 2) blockers.push(`admin_count=${affected(admins)} expected=2`);
  if (missingAdmins.length) blockers.push(`missing_admins=${missingAdmins.join(",")}`);
  if (extraAdmins.length) blockers.push(`extra_admins=${extraAdmins.join(",")}`);
  if (suspiciousReal.length) blockers.push(`possible_real_customer_payments=${suspiciousReal.length}`);

  return {
    keep: KEEP_ADMIN_EMAILS,
    auth_users: authUsers,
    admins: admins.rows.map((r) => ({
      email: r.email,
      role: r.role,
      synthetic: r.is_synthetic,
      referral_code: r.referral_code,
      has_active_id: Boolean(r.active_id),
    })),
    admin_count: affected(admins),
    keep_found: keepFound,
    extra_admins: extraAdmins,
    missing_admins: missingAdmins,
    non_admin_users: affected(members),
    non_admin_emails: members.rows.map((r) => ({
      email: r.email,
      role: r.role,
      synthetic: r.is_synthetic,
    })),
    synthetic_members: synthetic,
    tables,
    joining_value_bdt: joining.rows[0]?.v ?? 0,
    purchased_id_count: joining.rows[0]?.ids ?? 0,
    payment_mix: paymentMix,
    approved_digital_payments: approvedDigital.map((r) => ({
      method: r.payment_method,
      email: r.email,
      synthetic: r.is_synthetic,
      amount_bdt: r.expected_amount_bdt,
    })),
    possible_real_customer_payments: suspiciousReal.length,
    previous_reset_at: already.rows[0]?.value ?? null,
    blockers,
    gate: blockers.length ? "BLOCK" : "PASS",
  };
}

export async function applyReset(client, inv, env = process.env) {
  if (inv.gate !== "PASS") {
    throw new Error(`Refusing reset: ${inv.blockers.join("; ")}`);
  }
  if (inv.previous_reset_at && env.FORCE !== "1") {
    throw new Error(`Reset already applied at ${inv.previous_reset_at}. Set FORCE=1 to override.`);
  }
  if (env.CONFIRM !== CONFIRM_TOKEN) {
    throw new Error(`CONFIRM=${CONFIRM_TOKEN} is required`);
  }

  const keepParams = KEEP_ADMIN_EMAILS;
  const KEEP_LIST_SQL = KEEP_ADMIN_EMAILS.map((_, i) => `$${i + 1}`).join(", ");

  const optionalDeletes = [
    ["wallet_transactions", `delete from wallet_transactions`],
    ["withdrawal_requests", `delete from withdrawal_requests`],
    ["held_commissions", `delete from held_commissions`],
    ["commission_entries", `delete from commission_entries`],
    ["level_progress", `delete from level_progress`],
    ["generation_memberships", `delete from generation_memberships`],
    ["placement_relationships", `delete from placement_relationships`],
    ["sponsor_relationships", `delete from sponsor_relationships`],
    ["notifications", `delete from notifications`],
    ["payment_requests", `delete from payment_requests`],
    ["payments", `delete from payments`],
    ["user_packages", `delete from user_packages`],
    ["package_purchases", `delete from package_purchases`],
    ["purchase_idempotency", `delete from purchase_idempotency`],
    ["wallets", `delete from wallets`],
    ["member_ids", `delete from member_ids`],
  ];

  const deleted = {};
  for (const [name, sql] of optionalDeletes) {
    if (!(await tableExists(client, name))) {
      deleted[name] = 0;
      continue;
    }
    const r = await client.query(sql);
    deleted[name] = affected(r);
  }

  const audit = await client.query(
    `delete from audit_logs
     where not (action = 'user.role' and entity_type = 'app_users')`,
  );
  deleted.audit_logs = affected(audit);

  const dropUsers = await client.query(
    `select user_id from app_users
     where coalesce(lower(email), '') not in (${KEEP_LIST_SQL})`,
    keepParams,
  );
  const dropIds = dropUsers.rows.map((r) => r.user_id);

  if (dropIds.length) {
    if (await tableExists(client, "session")) {
      await client.query(`delete from "session" where "userId" = any($1::text[])`, [dropIds]);
    }
    if (await tableExists(client, "account")) {
      await client.query(`delete from "account" where "userId" = any($1::text[])`, [dropIds]);
    }
    const dropEmails = dropUsers.rows
      .map((r) => String(r.email || "").toLowerCase())
      .filter(Boolean);
    if (dropEmails.length && (await tableExists(client, "verification"))) {
      await client.query(`delete from "verification" where lower(identifier) = any($1::text[])`, [
        dropEmails,
      ]);
    }
    await client.query(`delete from app_users where user_id = any($1::text[])`, [dropIds]);
    await client.query(`delete from "user" where id = any($1::text[])`, [dropIds]);
  }
  await client.query(
    `delete from "session" where "userId" in (select id from "user" where lower(email) not in (${KEEP_LIST_SQL}))`,
    keepParams,
  );
  await client.query(
    `delete from "account" where "userId" in (select id from "user" where lower(email) not in (${KEEP_LIST_SQL}))`,
    keepParams,
  );
  await client.query(
    `delete from "user" where lower(email) not in (${KEEP_LIST_SQL})`,
    keepParams,
  );
  deleted.dropped_non_admin_users = dropIds.length;

  await client.query(
    `update app_users
     set active_id = null,
         intended_referral_code = null,
         intended_sponsor_user_id = null
     where coalesce(lower(email), '') in (${KEEP_LIST_SQL})`,
    keepParams,
  );

  await client.query(`alter sequence if exists member_id_seq restart with 100001`);

  await client.query(
    `insert into app_settings (key, value, updated_at)
     values ('batch1_test_reset_at', $1, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [new Date().toISOString()],
  );

  return deleted;
}

export async function runResetCli({ apply = false, env = process.env } = {}) {
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    const before = await inventory(client);
    console.log("INVENTORY_BEFORE");
    console.log(JSON.stringify(before, null, 2));
    if (!apply) return before;
    await client.query("BEGIN");
    try {
      const deleted = await applyReset(client, before, env);
      const after = await inventory(client);
      await client.query("COMMIT");
      console.log("DELETED");
      console.log(JSON.stringify(deleted, null, 2));
      console.log("INVENTORY_AFTER");
      console.log(JSON.stringify(after, null, 2));
      const leftover =
        after.tables.member_ids ||
        after.tables.package_purchases ||
        after.non_admin_users ||
        after.admin_count !== 2;
      if (leftover) throw new Error("POST_RESET_FAILED leftover business rows");
      console.log("RESET_OK");
      return { before, deleted, after };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

const isMain =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  runResetCli({ apply: process.argv.includes("--apply") })
    .then((result) => {
      if (!process.argv.includes("--apply") && result?.gate === "BLOCK") process.exit(2);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
