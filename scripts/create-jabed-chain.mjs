/**
 * Create Jabed-1, Jabed-2, and Jabed-3 under the Link Mate admin.
 * Does not turn on company share and does not write commissions.
 *
 *   CONFIRM=CREATE-JABED-CHAIN node scripts/create-jabed-chain.mjs
 */
import pg from "pg";

const EMAIL = "linkmateglobal@gmail.com";
if (process.env.CONFIRM !== "CREATE-JABED-CHAIN") {
  console.error("Refusing: CONFIRM token missing");
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const LEVELS = [
  [1, 1, 3, 2640],
  [2, 2, 9, 5940],
  [3, 3, 27, 8910],
  [4, 4, 54, 11880],
  [5, 5, 108, 14256],
  [6, 6, 162, 17820],
  [7, 7, 216, 23760],
  [8, 8, 270, 29700],
  [9, 9, 324, 35640],
];

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  const owner = await client.query(
    `select user_id from app_users where lower(email) = $1 and role = 'admin'`,
    [EMAIL],
  );
  if (owner.rows.length !== 1) throw new Error("Admin account was not found");
  const userId = owner.rows[0].user_id;
  const members = await client.query(`select count(*)::int as n from member_ids`);
  const commissions = await client.query(`select count(*)::int as n from commission_entries`);
  const percent = await client.query(
    `select value from app_settings where key = 'company_share_percent'`,
  );
  if (Number(members.rows[0].n) !== 0 || Number(commissions.rows[0].n) !== 0) {
    throw new Error("Refusing: business rows already exist");
  }
  if (String(percent.rows[0]?.value ?? "").trim()) {
    throw new Error("Refusing: company share is already on");
  }

  await client.query("begin");
  const ids = [];
  for (let i = 0; i < 3; i += 1) {
    const seq = await client.query(`select nextval('member_id_seq')::int as n`);
    ids.push(`LM-${seq.rows[0].n}`);
  }
  const names = ["JABED1", "JABED2", "JABED3"];
  const chain = [
    { id: ids[0], sponsor: null, parent: null, code: names[0] },
    { id: ids[1], sponsor: ids[0], parent: ids[0], code: names[1] },
    { id: ids[2], sponsor: ids[1], parent: ids[1], code: names[2] },
  ];
  for (const row of chain) {
    await client.query(
      `insert into member_ids (
         id, owner_user_id, package_id, is_root, sponsor_id, parent_id,
         placement_status, status, joining_amount_bdt, referral_code,
         current_level, progression_status, activated_at, origin_kind
       ) values (
         $1, $2, 'builder', true, $3, $4,
         'placed', 'active', 11000, $5,
         1, 'ACTIVE', now(), 'company_seed'
       )`,
      [row.id, userId, row.sponsor, row.parent, row.code],
    );
    await client.query(
      `insert into wallets (member_id, owner_user_id, available_balance, total_released)
       values ($1, $2, 0, 0)`,
      [row.id, userId],
    );
    for (const [level, generation, required, expected] of LEVELS) {
      await client.query(
        `insert into level_progress (
           id, member_id, level, generation, required_members, completed_members,
           remaining_members, accumulated_commission, expected_full_commission, status
         ) values ($1, $2, $3, $4, $5, 0, $5, 0, $6, $7)`,
        [
          `seed:${row.id}:${level}`,
          row.id,
          level,
          generation,
          required,
          expected,
          level === 1 ? "IN_PROGRESS" : "LOCKED",
        ],
      );
    }
    await client.query(
      `insert into membership_activation_events (
         id, member_id, owner_user_id, sponsor_id, joining_amount_bdt, ancestry_model
       ) values ($1, $2, $3, $4, 11000, 'placement')`,
      [`activate:${row.id}`, row.id, userId, row.sponsor],
    );
  }
  await client.query(
    `insert into sponsor_relationships (id, sponsor_id, sponsored_id) values
       ($1, $2, $3), ($4, $5, $6)`,
    [`sponsor:${ids[1]}`, ids[0], ids[1], `sponsor:${ids[2]}`, ids[1], ids[2]],
  );
  await client.query(
    `insert into placement_relationships (id, parent_id, child_id, position) values
       ($1, $2, $3, 1), ($4, $5, $6, 1)`,
    [`place:${ids[1]}`, ids[0], ids[1], `place:${ids[2]}`, ids[1], ids[2]],
  );
  await client.query(
    `update app_users set active_id = $1 where user_id = $2`,
    [ids[2], userId],
  );
  await client.query(
    `insert into app_settings (key, value, updated_at) values
       ('company_share_member_ids', $1, now()),
       ('company_level_exempt_member_ids', $2, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [`${ids[0]},${ids[1]},${ids[2]}`, `${ids[0]},${ids[1]}`],
  );
  const check = await client.query(
    `select
       (select count(*)::int from member_ids) as members,
       (select count(*)::int from commission_entries) as commissions,
       (select coalesce(sum(available_balance),0)::int from wallets) as available,
       (select value from app_settings where key = 'company_share_percent') as percent`,
  );
  const row = check.rows[0];
  if (Number(row.members) !== 3 || Number(row.commissions) !== 0 || Number(row.available) !== 0) {
    throw new Error("Seed check failed");
  }
  if (String(row.percent ?? "").trim()) throw new Error("Percent was turned on");
  await client.query("commit");
  console.log(JSON.stringify({
    ok: true,
    jabed1: ids[0],
    jabed2: ids[1],
    jabed3: ids[2],
    codes: names,
    commissions: 0,
    available: 0,
    percent: "",
  }));
} catch (error) {
  try { await client.query("rollback"); } catch { /* no transaction */ }
  console.error(error instanceof Error ? error.message : "seed failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
