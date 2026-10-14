import pg from "pg";

const KEEP = ["hello.habibwahid@gmail.com", "linkmateglobal@gmail.com"];
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

async function count(sql) {
  const result = await client.query(sql);
  return Number(result.rows[0]?.n ?? 0);
}

try {
  const admins = await client.query(
    `select lower(email) as email, role from app_users where role = 'admin'`,
  );
  const emails = admins.rows.map((row) => String(row.email || ""));
  const cutover = await client.query(
    `select value from app_settings where key = 'placement_rules_cutover_at'`,
  );
  const tables = [
    "member_ids",
    "package_purchases",
    "sponsor_relationships",
    "sponsor_designation_credits",
    "placement_relationships",
    "commission_entries",
    "held_commissions",
    "wallets",
    "wallet_transactions",
    "level_progress",
    "packages",
    "commission_rules",
  ];
  const counts = {};
  for (const table of tables) {
    const exists = await client.query(`select to_regclass($1) as name`, [`public.${table}`]);
    counts[table] = exists.rows[0]?.name ? await count(`select count(*)::int as n from ${table}`) : 0;
  }
  console.log(
    JSON.stringify({
      admin_count: admins.rows.length,
      keep_present: KEEP.filter((email) => emails.includes(email)).length,
      extra_admins: emails.filter((email) => !KEEP.includes(email)).length,
      non_admin_users: await count(`select count(*)::int as n from app_users where role <> 'admin'`),
      tables: counts,
      cutover: cutover.rows[0]?.value ?? "",
    }),
  );
} finally {
  client.release();
  await pool.end();
}
