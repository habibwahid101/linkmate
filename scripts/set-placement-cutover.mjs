#!/usr/bin/env node
/**
 * Turn on placement rules for future activations only.
 * Sets app_settings.placement_rules_cutover_at when it is empty.
 * Does not update wallets, commissions, members, or packages.
 *
 *   CONFIRM=SET_PLACEMENT_CUTOVER node scripts/set-placement-cutover.mjs
 */
import pg from "pg";

if (process.env.CONFIRM !== "SET_PLACEMENT_CUTOVER") {
  console.error("Refusing: set CONFIRM=SET_PLACEMENT_CUTOVER");
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl || !/^postgres(ql)?:\/\//.test(databaseUrl)) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

const countsSql = `
  select
    (select count(*)::int from wallet_transactions) as wallet_rows,
    (select count(*)::int from commission_entries) as commission_rows,
    (select count(*)::int from member_ids) as member_rows
`;

try {
  const ready = await client.query(
    `select
       (select count(*)::int from information_schema.columns
         where table_name = 'commission_entries' and column_name = 'ancestry_model') as ancestry,
       (select count(*)::int from information_schema.columns
         where table_name = 'level_progress' and column_name = 'placement_completed_members') as placement_count`,
  );
  if (Number(ready.rows[0]?.ancestry) !== 1 || Number(ready.rows[0]?.placement_count) !== 1) {
    throw new Error("Placement schema is not present. Cutover was not set.");
  }

  await client.query("begin");
  const before = await client.query(countsSql);
  const existing = await client.query(
    `select value from app_settings where key = 'placement_rules_cutover_at' for update`,
  );
  const previous = existing.rows[0] ? String(existing.rows[0].value ?? "") : null;
  const trimmed = String(previous ?? "").trim();
  const parsed = Date.parse(trimmed);
  const already = Boolean(trimmed) && !Number.isNaN(parsed) && parsed <= Date.now();
  let value = trimmed;
  let changed = false;
  if (!already) {
    value = new Date().toISOString();
    changed = true;
    if (previous === null) {
      await client.query(
        `insert into app_settings (key, value, updated_by, updated_at)
         values ('placement_rules_cutover_at', $1, 'system', now())`,
        [value],
      );
    } else {
      await client.query(
        `update app_settings
         set value = $1, updated_by = 'system', updated_at = now()
         where key = 'placement_rules_cutover_at'`,
        [value],
      );
    }
    await client.query(
      `insert into audit_logs (id, actor_user_id, action, entity_type, entity_id, detail)
       values ($1, 'system', 'settings.update', 'app_settings', 'placement_rules_cutover_at', $2)`,
      [`cutover-${Date.now()}`, `placement cutover set ${value}`],
    );
  }
  const after = await client.query(countsSql);
  const same =
    before.rows[0].wallet_rows === after.rows[0].wallet_rows &&
    before.rows[0].commission_rows === after.rows[0].commission_rows &&
    before.rows[0].member_rows === after.rows[0].member_rows;
  if (!same) throw new Error("Row counts changed. Cutover was rolled back.");
  await client.query("commit");
  console.log(
    JSON.stringify({
      previous: previous ?? "",
      value,
      changed,
      wallet_rows: after.rows[0].wallet_rows,
      commission_rows: after.rows[0].commission_rows,
      member_rows: after.rows[0].member_rows,
    }),
  );
} catch (error) {
  try {
    await client.query("rollback");
  } catch {
    /* no transaction open */
  }
  console.error(error instanceof Error ? error.message : "cutover failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
