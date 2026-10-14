import pg from "pg";
import { inventory } from "./reset-test-business.mjs";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  const inv = await inventory(client);
  const cutover = await client.query(
    "select value from app_settings where key = 'placement_rules_cutover_at'",
  );
  console.log(
    JSON.stringify({
      gate: inv.gate,
      blockers: inv.blockers,
      admin_count: inv.admin_count,
      keep_found: inv.keep_found.length,
      missing_admins: inv.missing_admins.length,
      extra_admins: inv.extra_admins.length,
      non_admin_users: inv.non_admin_users,
      tables: inv.tables,
      possible_real_customer_payments: inv.possible_real_customer_payments,
      previous_reset_at: inv.previous_reset_at,
      cutover: cutover.rows[0]?.value ?? "",
    }),
  );
} finally {
  client.release();
  await pool.end();
}
