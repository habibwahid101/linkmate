/**
 * Read-only check for LM-100044. No writes.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
const id = "LM-100044";

try {
  const owner = await client.query(
    `select owner_user_id from member_ids where id = $1`,
    [id],
  );
  const userId = owner.rows[0]?.owner_user_id;
  if (!userId) {
    console.log(JSON.stringify({ ok: false, reason: "missing" }));
    process.exit(0);
  }
  const money = await client.query(
    `select coalesce(w.available_balance,0)::int as available,
            coalesce(w.total_released,0)::int as released,
            coalesce((select sum(amount)::int from held_commissions where member_id = $1),0) as held,
            coalesce((select sum(amount)::int from wallet_transactions
              where member_id = $1 and status = 'posted' and type = 'RELEASE'),0) as release_tx
     from wallets w where w.member_id = $1`,
    [id],
  );
  const levels = await client.query(
    `select level, completed_members, placement_completed_members, required_members, status,
            accumulated_commission::int as accumulated
     from level_progress where member_id = $1 and level <= 4
     order by level`,
    [id],
  );
  const credits = await client.query(
    `select sponsored_id from sponsor_designation_credits
     where sponsor_id = $1 and voided_at is null order by sponsored_id`,
    [id],
  );
  const byLevel = await client.query(
    `select level, status, count(*)::int as n, coalesce(sum(commission_amount),0)::int as amount
     from commission_entries where beneficiary_id = $1
     group by level, status order by level, status`,
    [id],
  );
  console.log(JSON.stringify({
    ok: true,
    money: money.rows[0] ?? null,
    levels: levels.rows,
    sponsorCredits: credits.rows.length,
    byLevel: byLevel.rows,
  }));
} finally {
  client.release();
  await pool.end();
}
