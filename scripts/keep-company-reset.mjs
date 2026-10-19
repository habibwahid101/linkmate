/**
 * Remove every membership except the two admins and the three 1% company IDs.
 * Also deletes every wallet and every designation credit, including leftovers
 * on reused ID numbers, then rebuilds empty wallets for the three kept IDs.
 *
 *   node scripts/keep-company-reset.mjs
 *   CONFIRM=KEEP-COMPANY-RESET node scripts/keep-company-reset.mjs --apply
 */
import pg from "pg";

const ADMINS = ["hello.habibwahid@gmail.com", "linkmateglobal@gmail.com"];
const COMPANY_IDS = ["LM-100001", "LM-100002", "LM-100003"];
const SHARE = "LM-100001,LM-100002,LM-100003";
const EXEMPT = "LM-100001,LM-100002";

const apply = process.argv.includes("--apply");
if (apply && process.env.CONFIRM !== "KEEP-COMPANY-RESET") {
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

async function snapshot() {
  const admins = await client.query(
    `select lower(email) as email from app_users where role = 'admin' order by email`,
  );
  const members = await client.query(
    `select m.id, m.origin_kind, m.sponsor_id, m.parent_id,
            coalesce(u.email, '') as owner_email,
            coalesce(w.available_balance, 0)::int as available,
            coalesce(w.total_released, 0)::int as released
     from member_ids m
     left join app_users u on u.user_id = m.owner_user_id
     left join wallets w on w.member_id = m.id
     where m.id = any($1::text[])
     order by m.id`,
    [COMPANY_IDS],
  );
  const held = await client.query(
    `select member_id, coalesce(sum(amount), 0)::int as held
     from held_commissions where member_id = any($1::text[])
     group by member_id`,
    [COMPANY_IDS],
  );
  const credits = await client.query(
    `select sponsor_id, count(*)::int as n
     from sponsor_designation_credits
     where sponsor_id = any($1::text[]) and voided_at is null
     group by sponsor_id`,
    [COMPANY_IDS],
  );
  const settings = await client.query(
    `select key, value from app_settings
     where key in ('company_share_percent', 'company_share_member_ids', 'company_level_exempt_member_ids', 'placement_rules_cutover_at')`,
  );
  const counts = await client.query(
    `select
       (select count(*)::int from member_ids) as members,
       (select count(*)::int from app_users) as users`,
  );
  const heldMap = new Map(held.rows.map((row) => [row.member_id, Number(row.held)]));
  const creditMap = new Map(credits.rows.map((row) => [row.sponsor_id, Number(row.n)]));
  return {
    admins: admins.rows.map((row) => row.email),
    members: members.rows.map((row) => ({
      id: row.id,
      origin: row.origin_kind,
      sponsor: row.sponsor_id,
      parent: row.parent_id,
      available: Number(row.available),
      released: Number(row.released),
      held: heldMap.get(row.id) ?? 0,
      credits: creditMap.get(row.id) ?? 0,
    })),
    settings: Object.fromEntries(settings.rows.map((row) => [row.key, String(row.value ?? "")])),
    counts: counts.rows[0],
  };
}

function sameIdentity(before, after) {
  const shape = (rows) => rows.map((row) => [row.id, row.origin, row.sponsor, row.parent].join(":")).join(",");
  return shape(before.members) === shape(after.members)
    && before.settings.company_share_percent === after.settings.company_share_percent
    && before.settings.company_share_member_ids === after.settings.company_share_member_ids
    && before.settings.company_level_exempt_member_ids === after.settings.company_level_exempt_member_ids
    && before.settings.placement_rules_cutover_at === after.settings.placement_rules_cutover_at;
}

try {
  const before = await snapshot();
  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "inventory", ...before }));
    process.exit(0);
  }

  if (before.admins.length !== 2 || ADMINS.some((email) => !before.admins.includes(email))) {
    throw new Error("Refusing: admin set is not the two kept accounts");
  }
  if (before.members.length !== 3) throw new Error("Refusing: the three company IDs are not all present");
  if (before.members.some((row) => row.origin !== "company_seed")) {
    throw new Error("Refusing: a kept ID is not a company seed");
  }
  for (const row of before.members) {
    if (row.sponsor && !COMPANY_IDS.includes(row.sponsor)) throw new Error("Refusing: company sponsor is outside the three IDs");
    if (row.parent && !COMPANY_IDS.includes(row.parent)) throw new Error("Refusing: company placement is outside the three IDs");
  }
  if (before.settings.company_share_member_ids !== SHARE) throw new Error("Refusing: company share IDs changed");
  if (before.settings.company_level_exempt_member_ids !== EXEMPT) throw new Error("Refusing: exempt IDs changed");
  if (!before.settings.placement_rules_cutover_at.trim()) throw new Error("Refusing: cutover is not set");

  await client.query("begin");
  const deleted = {};
  const keep = COMPANY_IDS;

  if (await exists("membership_activation_impacts")) {
    deleted.membership_activation_impacts = n(await client.query(
      `delete from membership_activation_impacts
       where event_id in (
         select id from membership_activation_events where member_id <> all($1::text[])
       )`,
      [keep],
    ));
  }
  if (await exists("membership_activation_events")) {
    deleted.membership_activation_events = n(await client.query(
      `delete from membership_activation_events where member_id <> all($1::text[])`,
      [keep],
    ));
  }

  const memberTables = [
    ["wallet_transactions", "member_id"],
    ["withdrawal_requests", "member_id"],
    ["held_commissions", "member_id"],
    ["commission_entries", "beneficiary_id"],
    ["level_progress", "member_id"],
    ["generation_memberships", "member_id"],
    ["sponsor_relationships", "sponsored_id"],
    ["placement_relationships", "child_id"],
  ];
  for (const [table, column] of memberTables) {
    if (!(await exists(table))) {
      deleted[table] = 0;
      continue;
    }
    const columns = await client.query(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
      [table],
    );
    const names = new Set(columns.rows.map((row) => row.column_name));
    if (!names.has(column)) {
      deleted[table] = 0;
      continue;
    }
    deleted[table] = n(await client.query(
      `delete from ${table} where ${column} <> all($1::text[])`,
      [keep],
    ));
  }
  if (await exists("sponsor_relationships")) {
    deleted.sponsor_relationships_outside = n(await client.query(
      `delete from sponsor_relationships where sponsor_id <> all($1::text[])`,
      [keep],
    ));
  }
  if (await exists("placement_relationships")) {
    deleted.placement_relationships_outside = n(await client.query(
      `delete from placement_relationships where parent_id <> all($1::text[])`,
      [keep],
    ));
  }
  if (await exists("generation_memberships")) {
    deleted.generation_memberships_outside = n(await client.query(
      `delete from generation_memberships where beneficiary_id <> all($1::text[])`,
      [keep],
    ));
  }
  if (await exists("sponsor_designation_credits")) {
    deleted.sponsor_designation_credits = n(await client.query(
      `delete from sponsor_designation_credits where sponsor_id <> all($1::text[])`,
      [keep],
    ));
  }

  deleted.member_ids = n(await client.query(
    `delete from member_ids where id <> all($1::text[])`,
    [keep],
  ));

  const keepUsers = await client.query(
    `select user_id from app_users
     where lower(email) = any($1::text[])
        or user_id in (select owner_user_id from member_ids)`,
    [ADMINS],
  );
  const keepUserIds = keepUsers.rows.map((row) => row.user_id);
  if (keepUserIds.length < 2) throw new Error("Refusing: kept user set is too small");

  if (await exists("payment_requests")) {
    deleted.payment_requests = n(await client.query(
      `delete from payment_requests where user_id <> all($1::text[])`,
      [keepUserIds],
    ));
  }
  if (await exists("payments")) {
    deleted.payments = n(await client.query(
      `delete from payments
       where purchase_id in (
         select id from package_purchases where user_id <> all($1::text[])
       )`,
      [keepUserIds],
    ));
  }
  if (await exists("user_packages")) {
    deleted.user_packages = n(await client.query(
      `delete from user_packages where user_id <> all($1::text[])`,
      [keepUserIds],
    ));
  }
  if (await exists("package_purchases")) {
    deleted.package_purchases = n(await client.query(
      `delete from package_purchases
       where user_id <> all($1::text[])
         and id not in (select purchase_id from member_ids where purchase_id is not null)`,
      [keepUserIds],
    ));
  }
  if (await exists("notifications")) {
    deleted.notifications = n(await client.query(
      `delete from notifications where user_id <> all($1::text[])`,
      [keepUserIds],
    ));
  }
  if (await exists("purchase_idempotency")) {
    deleted.purchase_idempotency = n(await client.query(`delete from purchase_idempotency`));
  }
  if (await exists("audit_logs")) {
    deleted.audit_logs = n(await client.query(`delete from audit_logs`));
  }
  if (await exists("withdrawal_requests")) {
    deleted.withdrawal_requests_users = n(await client.query(
      `delete from withdrawal_requests where owner_user_id <> all($1::text[])`,
      [keepUserIds],
    ));
  }

  const dropUsers = await client.query(
    `select user_id from app_users where user_id <> all($1::text[])`,
    [keepUserIds],
  );
  const dropIds = dropUsers.rows.map((row) => row.user_id);
  if (dropIds.length) {
    if (await exists("session")) {
      await client.query(`delete from "session" where "userId" = any($1::text[])`, [dropIds]);
    }
    if (await exists("account")) {
      await client.query(`delete from "account" where "userId" = any($1::text[])`, [dropIds]);
    }
    deleted.app_users = n(await client.query(
      `delete from app_users where user_id = any($1::text[])`,
      [dropIds],
    ));
    if (await exists("user")) {
      await client.query(`delete from "user" where id = any($1::text[])`, [dropIds]);
    }
  }
  if (await exists("user")) {
    if (await exists("session")) {
      await client.query(
        `delete from "session" where "userId" in (
           select id from "user" where lower(email) not in (select lower(email) from app_users where email is not null)
         )`,
      );
    }
    if (await exists("account")) {
      await client.query(
        `delete from "account" where "userId" in (
           select id from "user" where lower(email) not in (select lower(email) from app_users where email is not null)
         )`,
      );
    }
    await client.query(
      `delete from "user" where lower(email) not in (select lower(email) from app_users where email is not null)`,
    );
  }

  if (await exists("sponsor_designation_credits")) {
    deleted.designation_credits_all = n(await client.query(`delete from sponsor_designation_credits`));
  }
  if (await exists("wallet_transactions")) {
    deleted.wallet_transactions_kept = n(await client.query(
      `delete from wallet_transactions where member_id = any($1::text[])`,
      [keep],
    ));
  }
  if (await exists("held_commissions")) {
    deleted.held_kept = n(await client.query(
      `delete from held_commissions where member_id = any($1::text[])`,
      [keep],
    ));
  }
  if (await exists("commission_entries")) {
    deleted.commissions_kept = n(await client.query(
      `delete from commission_entries where beneficiary_id = any($1::text[])`,
      [keep],
    ));
  }
  if (await exists("wallets")) {
    deleted.wallets = n(await client.query(`delete from wallets`));
    deleted.wallets_rebuilt = n(await client.query(
      `insert into wallets (member_id, owner_user_id, available_balance, total_released)
       select id, owner_user_id, 0, 0 from member_ids where id = any($1::text[])`,
      [keep],
    ));
  }
  if (await exists("level_progress")) {
    deleted.levels_reset = n(await client.query(
      `update level_progress set
         completed_members = 0,
         placement_completed_members = 0,
         remaining_members = required_members,
         accumulated_commission = 0,
         status = case when level = 1 then 'IN_PROGRESS' else 'LOCKED' end,
         completed_at = null,
         released_at = null
       where member_id = any($1::text[])`,
      [keep],
    ));
  }
  await client.query(
    `update member_ids
     set current_level = 1, progression_status = 'ACTIVE'
     where id = any($1::text[])`,
    [keep],
  );

  await client.query(
    `select setval(
       'member_id_seq',
       greatest((select max(substring(id from 4)::int) from member_ids), 100000)
     )`,
  );
  await client.query(
    `insert into app_settings (key, value, updated_at)
     values ('company_keep_reset_at', $1, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [new Date().toISOString()],
  );

  const after = await snapshot();
  const walletCheck = await client.query(
    `select count(*)::int as n,
            coalesce(sum(available_balance),0)::int as available,
            count(*) filter (where member_id <> all($1::text[]))::int as outside
     from wallets`,
    [keep],
  );
  const creditCheck = await client.query(`select count(*)::int as n from sponsor_designation_credits`);
  if (!sameIdentity(before, after)) throw new Error("Refusing: a kept company ID changed");
  if (after.members.some((row) => row.available !== 0 || row.released !== 0 || row.held !== 0 || row.credits !== 0)) {
    throw new Error("Refusing: a kept ID still has money or a designation");
  }
  if (Number(walletCheck.rows[0].n) !== 3 || Number(walletCheck.rows[0].available) !== 0 || Number(walletCheck.rows[0].outside) !== 0) {
    throw new Error("Refusing: wallets were not cleared");
  }
  if (Number(creditCheck.rows[0].n) !== 0) throw new Error("Refusing: designations were not cleared");
  if (Number(after.counts.members) !== 3) throw new Error("Refusing: member count is not 3");
  if (after.admins.length !== 2) throw new Error("Refusing: admin count changed");

  await client.query("commit");
  console.log(JSON.stringify({
    ok: true,
    mode: "apply",
    deleted,
    kept: after.members,
    remaining_members: Number(after.counts.members),
    remaining_users: Number(after.counts.users),
    admins: after.admins.length,
    wallets: walletCheck.rows[0],
    designations: Number(creditCheck.rows[0].n),
  }));
} catch (error) {
  try { await client.query("rollback"); } catch { /* not in a transaction */ }
  console.error(error instanceof Error ? error.message : "reset failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
