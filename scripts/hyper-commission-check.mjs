/**
 * Read-only breakdown for LM-100003. No writes.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
const id = "LM-100003";

try {
  const wallet = await client.query(
    `select available_balance::int as available, total_released::int as released
     from wallets where member_id = $1`,
    [id],
  );
  const tx = await client.query(
    `select type, count(*)::int as n, coalesce(sum(amount),0)::int as amount
     from wallet_transactions where member_id = $1 and status = 'posted'
     group by type order by type`,
    [id],
  );
  const levels = await client.query(
    `select level, placement_completed_members, required_members, status,
            accumulated_commission::int as accumulated
     from level_progress where member_id = $1 and level <= 5
     order by level`,
    [id],
  );
  const held = await client.query(
    `select coalesce(sum(amount),0)::int as held from held_commissions where member_id = $1`,
    [id],
  );
  const credits = await client.query(
    `select count(*)::int as n from sponsor_designation_credits
     where sponsor_id = $1 and voided_at is null`,
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
    wallet: wallet.rows[0] ?? null,
    tx: tx.rows,
    held: Number(held.rows[0].held),
    credits: Number(credits.rows[0].n),
    levels: levels.rows,
    byLevel: byLevel.rows,
  }));
} finally {
  client.release();
  await pool.end();
}
