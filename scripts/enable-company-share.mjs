/**
 * Turn on the 1% company share for future IDs only.
 * Does not change wallets, commissions, or past rows.
 *
 *   CONFIRM=ENABLE-COMPANY-SHARE node scripts/enable-company-share.mjs
 */
import pg from "pg";

const IDS = "LM-100001,LM-100002,LM-100003";
const EXEMPT = "LM-100001,LM-100002";
if (process.env.CONFIRM !== "ENABLE-COMPANY-SHARE") {
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

try {
  const settings = await client.query(
    `select key, value from app_settings
     where key in (
       'company_share_percent',
       'company_share_member_ids',
       'company_level_exempt_member_ids'
     )`,
  );
  const map = new Map(settings.rows.map((row) => [row.key, String(row.value ?? "").trim()]));
  if (map.get("company_share_member_ids") !== IDS) throw new Error("Member list does not match");
  if (map.get("company_level_exempt_member_ids") !== EXEMPT) throw new Error("Exempt list does not match");
  const current = map.get("company_share_percent") ?? "";
  if (current !== "" && current !== "1") throw new Error("Unexpected percent");

  const check = await client.query(
    `select
       (select count(*)::int from member_ids where id in ('LM-100001','LM-100002','LM-100003') and origin_kind = 'company_seed') as seeds,
       (select count(*)::int from commission_entries) as commissions,
       (select coalesce(sum(available_balance),0)::int from wallets) as available`,
  );
  const row = check.rows[0];
  if (Number(row.seeds) !== 3) throw new Error("Seed IDs missing");
  if (Number(row.commissions) !== 0 || Number(row.available) !== 0) {
    throw new Error("Refusing: money rows already exist");
  }

  if (current !== "1") {
    await client.query("begin");
    await client.query(
      `update app_settings set value = '1', updated_at = now() where key = 'company_share_percent'`,
    );
    await client.query("commit");
  }
  const after = await client.query(
    `select value from app_settings where key = 'company_share_percent'`,
  );
  console.log(JSON.stringify({
    ok: true,
    percent: String(after.rows[0]?.value ?? ""),
    members: IDS,
    exempt: EXEMPT,
    commissions: 0,
    available: 0,
  }));
} catch (error) {
  try { await client.query("rollback"); } catch { /* no transaction */ }
  console.error(error instanceof Error ? error.message : "enable failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
