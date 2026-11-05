/**
 * Delete every account except admins and Jabed accounts.
 * Kept Jabed and admin IDs stay, including their LM numbers.
 * Their old wallet, commission, and level counts are zeroed.
 *
 *   node scripts/keep-admins-jabeds.mjs
 *   CONFIRM=KEEP-ADMINS-JABEDS node scripts/keep-admins-jabeds.mjs --apply
 */
import pg from "pg";

const apply = process.argv.includes("--apply");
if (apply && process.env.CONFIRM !== "KEEP-ADMINS-JABEDS") {
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

const keepSql = `
  select u.user_id, u.display_name, u.email, u.role,
         coalesce(array_agg(m.id order by m.id) filter (where m.id is not null), '{}') as ids
  from app_users u
  left join member_ids m on m.owner_user_id = u.user_id
  where u.role = 'admin'
     or u.display_name ~* 'jabed'
  group by u.user_id, u.display_name, u.email, u.role
  order by u.role, u.display_name
`;

try {
  const keep = await client.query(keepSql);
  const all = await client.query(
    `select role, count(*)::int as n from app_users group by role order by role`,
  );
  const members = await client.query(`select count(*)::int as n from member_ids`);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "inventory",
    users: all.rows,
    members: members.rows[0]?.n,
    keep: keep.rows,
  }));
  if (!apply) process.exit(0);

  const keepIds = keep.rows.map((row) => row.user_id);
  const admins = keep.rows.filter((row) => row.role === "admin");
  const jabeds = keep.rows.filter((row) => row.role !== "admin");
  if (admins.length < 1) throw new Error("Refusing: no admin account");
  if (jabeds.length < 1) throw new Error("Refusing: no Jabed account");
  if (jabeds.length > 6) throw new Error("Refusing: too many Jabed matches");

  await client.query("begin");
  const memberKeep = await client.query(
    `select id from member_ids where owner_user_id = any($1::text[])`,
    [keepIds],
  );
  const keepMembers = memberKeep.rows.map((row) => row.id);
  if (keepMembers.length < 1) throw new Error("Refusing: kept accounts have no membership ID");

  const deleted = {};
  const dropMembers = await client.query(
    `select id from member_ids where id <> all($1::text[])`,
    [keepMembers],
  );
  const dropMemberIds = dropMembers.rows.map((row) => row.id);

  if (
    dropMemberIds.length &&
    (await exists("membership_activation_impacts")) &&
    (await exists("membership_activation_events"))
  ) {
    deleted["membership_activation_impacts.events"] = n(await client.query(
      `delete from membership_activation_impacts
       where beneficiary_id = any($1::text[])
          or event_id in (
            select id from membership_activation_events where member_id = any($1::text[])
          )`,
      [dropMemberIds],
    ));
  }

  const memberTables = [
    ["membership_activation_impacts", "beneficiary_id"],
    ["membership_activation_events", "member_id"],
    ["wallet_transactions", "member_id"],
    ["withdrawal_requests", "member_id"],
    ["held_commissions", "member_id"],
    ["commission_entries", "beneficiary_id"],
    ["commission_entries", "source_id"],
    ["level_progress", "member_id"],
    ["generation_memberships", "member_id"],
    ["generation_memberships", "beneficiary_id"],
    ["sponsor_relationships", "sponsored_id"],
    ["sponsor_relationships", "sponsor_id"],
    ["placement_relationships", "child_id"],
    ["placement_relationships", "parent_id"],
    ["sponsor_designation_credits", "sponsor_id"],
    ["sponsor_designation_credits", "sponsored_id"],
  ];
  for (const [table, column] of memberTables) {
    if (!(await exists(table)) || dropMemberIds.length === 0) continue;
    const columns = await client.query(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
      [table],
    );
    if (!columns.rows.some((row) => row.column_name === column)) continue;
    deleted[`${table}.${column}`] = n(await client.query(
      `delete from ${table} where ${column} = any($1::text[])`,
      [dropMemberIds],
    ));
  }

  if (await exists("member_ids") && dropMemberIds.length) {
    deleted.member_ids = n(await client.query(
      `delete from member_ids where id = any($1::text[])`,
      [dropMemberIds],
    ));
  }

  if (await exists("payment_requests")) {
    deleted.payment_requests = n(await client.query(
      `delete from payment_requests where user_id <> all($1::text[])`,
      [keepIds],
    ));
  }
  if (await exists("payments")) {
    deleted.payments = n(await client.query(
      `delete from payments where purchase_id in (
         select id from package_purchases where user_id <> all($1::text[])
       )`,
      [keepIds],
    ));
  }
  if (await exists("user_packages")) {
    deleted.user_packages = n(await client.query(
      `delete from user_packages
       where user_id <> all($1::text[])
          or purchase_id in (
            select id from package_purchases where user_id <> all($1::text[])
          )`,
      [keepIds],
    ));
  }
  if (await exists("purchase_idempotency")) {
    deleted.purchase_idempotency = n(await client.query(
      `delete from purchase_idempotency where user_id <> all($1::text[])`,
      [keepIds],
    ));
  }
  if (await exists("package_purchases")) {
    deleted.package_purchases = n(await client.query(
      `delete from package_purchases where user_id <> all($1::text[])`,
      [keepIds],
    ));
  }
  if (await exists("notifications")) {
    deleted.notifications = n(await client.query(
      `delete from notifications where user_id <> all($1::text[])`,
      [keepIds],
    ));
  }
  if (await exists("audit_logs")) {
    deleted.audit_logs = n(await client.query(`delete from audit_logs`));
  }

  const dropUsers = await client.query(
    `select user_id from app_users where user_id <> all($1::text[])`,
    [keepIds],
  );
  const dropUserIds = dropUsers.rows.map((row) => row.user_id);
  if (dropUserIds.length) {
    if (await exists("withdrawal_requests")) {
      const columns = await client.query(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'withdrawal_requests'`,
      );
      if (columns.rows.some((row) => row.column_name === "owner_user_id")) {
        deleted.withdrawal_owners = n(await client.query(
          `delete from withdrawal_requests where owner_user_id = any($1::text[])`,
          [dropUserIds],
        ));
      }
    }
    if (await exists("session")) {
      await client.query(`delete from "session" where "userId" = any($1::text[])`, [dropUserIds]);
    }
    if (await exists("account")) {
      await client.query(`delete from "account" where "userId" = any($1::text[])`, [dropUserIds]);
    }
    deleted.app_users = n(await client.query(
      `delete from app_users where user_id = any($1::text[])`,
      [dropUserIds],
    ));
    if (await exists("user")) {
      await client.query(`delete from "user" where id = any($1::text[])`, [dropUserIds]);
    }
  }

  if (await exists("wallet_transactions")) {
    deleted.kept_wallet_tx = n(await client.query(`delete from wallet_transactions where member_id = any($1::text[])`, [keepMembers]));
  }
  if (await exists("held_commissions")) {
    deleted.kept_held = n(await client.query(`delete from held_commissions where member_id = any($1::text[])`, [keepMembers]));
  }
  if (await exists("commission_entries")) {
    deleted.kept_commissions = n(await client.query(
      `delete from commission_entries where beneficiary_id = any($1::text[]) or source_id = any($1::text[])`,
      [keepMembers],
    ));
  }
  if (await exists("wallets")) {
    await client.query(`delete from wallets`);
    deleted.wallets_rebuilt = n(await client.query(
      `insert into wallets (member_id, owner_user_id, available_balance, total_released)
       select id, owner_user_id, 0, 0 from member_ids where id = any($1::text[])`,
      [keepMembers],
    ));
  }
  if (await exists("level_progress")) {
    await client.query(
      `update level_progress set
         required_members = case level
           when 1 then 2 when 2 then 4 when 3 then 8 when 4 then 16 when 5 then 32
           when 6 then 64 when 7 then 128 when 8 then 256 when 9 then 512
           else required_members end,
         expected_full_commission = case level
           when 1 then 1980 when 2 then 3520 when 3 then 6160 when 4 then 10560 when 5 then 17600
           when 6 then 28160 when 7 then 42240 when 8 then 56320 when 9 then 56320
           else expected_full_commission end,
         completed_members = 0,
         placement_completed_members = 0,
         remaining_members = case level
           when 1 then 2 when 2 then 4 when 3 then 8 when 4 then 16 when 5 then 32
           when 6 then 64 when 7 then 128 when 8 then 256 when 9 then 512
           else required_members end,
         accumulated_commission = 0,
         status = case when level = 1 then 'IN_PROGRESS' else 'LOCKED' end,
         completed_at = null,
         released_at = null
       where member_id = any($1::text[])`,
      [keepMembers],
    );
  }
  await client.query(
    `update member_ids set current_level = 1, progression_status = 'ACTIVE' where id = any($1::text[])`,
    [keepMembers],
  );
  if (await exists("sponsor_relationships")) {
    await client.query(`delete from sponsor_relationships where sponsored_id = any($1::text[]) or sponsor_id = any($1::text[])`, [keepMembers]);
  }
  if (await exists("placement_relationships")) {
    await client.query(`delete from placement_relationships where child_id = any($1::text[]) or parent_id = any($1::text[])`, [keepMembers]);
  }
  await client.query(`update member_ids set sponsor_id = null, parent_id = null where id = any($1::text[])`, [keepMembers]);

  await client.query("commit");
  const after = await client.query(keepSql);
  const left = await client.query(`select count(*)::int as users from app_users`);
  const leftMembers = await client.query(`select count(*)::int as members from member_ids`);
  console.log(JSON.stringify({ ok: true, deleted, left: left.rows[0], members: leftMembers.rows[0], keep: after.rows }));
} catch (error) {
  try { await client.query("rollback"); } catch { /* no transaction */ }
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
