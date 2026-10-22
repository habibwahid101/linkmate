/**
 * Read-only: find IDs paid more than the level table allows. No writes.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

const RATES = { 1: 880, 2: 660, 3: 330, 4: 220, 5: 132, 6: 110, 7: 110, 8: 110, 9: 110 };
const NEED = { 1: 3, 2: 9, 3: 27, 4: 54, 5: 108, 6: 162, 7: 216, 8: 270, 9: 324 };

try {
  const over = await client.query(
    `select c.beneficiary_id as id, c.level,
            count(*)::int as n,
            coalesce(sum(c.commission_amount),0)::int as paid,
            max(lp.required_members)::int as need,
            max(lp.placement_completed_members)::int as placed,
            max(lp.status) as status,
            max(m.progression_status) as progress,
            max(m.current_level)::int as current_level
     from commission_entries c
     join level_progress lp on lp.member_id = c.beneficiary_id and lp.level = c.level
     join member_ids m on m.id = c.beneficiary_id
     where c.status in ('HELD', 'RELEASED')
     group by c.beneficiary_id, c.level
     having count(*) > max(lp.required_members)
     order by count(*) desc
     limit 30`,
  );
  const heldAfter = await client.query(
    `select c.beneficiary_id as id, c.level, count(*)::int as n,
            coalesce(sum(c.commission_amount),0)::int as held
     from commission_entries c
     join level_progress lp on lp.member_id = c.beneficiary_id and lp.level = c.level
     where c.status = 'HELD' and lp.status = 'RELEASED'
     group by c.beneficiary_id, c.level
     order by sum(c.commission_amount) desc
     limit 20`,
  );
  const walletGap = await client.query(
    `select w.member_id as id,
            w.available_balance::int as available,
            w.total_released::int as released,
            coalesce(tx.posted,0)::int as tx_sum,
            coalesce(tx.release_sum,0)::int as release_tx,
            coalesce(tx.company_sum,0)::int as company_tx,
            coalesce(cm.released,0)::int as commission_released,
            coalesce(cm.held,0)::int as commission_held
     from wallets w
     left join (
       select member_id,
              coalesce(sum(amount),0)::int as posted,
              coalesce(sum(amount) filter (where type = 'RELEASE'),0)::int as release_sum,
              coalesce(sum(amount) filter (where type = 'COMPANY_SHARE'),0)::int as company_sum
       from wallet_transactions where status = 'posted'
       group by member_id
     ) tx on tx.member_id = w.member_id
     left join (
       select beneficiary_id,
              coalesce(sum(commission_amount) filter (where status = 'RELEASED'),0)::int as released,
              coalesce(sum(commission_amount) filter (where status = 'HELD'),0)::int as held
       from commission_entries
       group by beneficiary_id
     ) cm on cm.beneficiary_id = w.member_id
     where w.available_balance <> 0 or w.total_released <> 0
     order by w.available_balance desc
     limit 40`,
  );
  const dupRelease = await client.query(
    `select member_id as id, level, count(*)::int as n, coalesce(sum(amount),0)::int as amount
     from wallet_transactions
     where type = 'RELEASE' and status = 'posted'
     group by member_id, level
     having count(*) > 1
     order by sum(amount) desc
     limit 20`,
  );
  const graduated = await client.query(
    `select id, current_level, progression_status
     from member_ids where progression_status = 'GRADUATED'`
  );
  const summary = await client.query(
    `select
       (select count(*)::int from member_ids) as members,
       (select count(*)::int from commission_entries) as commissions,
       (select coalesce(sum(commission_amount),0)::int from commission_entries where status = 'RELEASED') as released,
       (select coalesce(sum(commission_amount),0)::int from commission_entries where status = 'HELD') as held,
       (select coalesce(sum(amount),0)::int from wallet_transactions where type = 'COMPANY_SHARE' and status = 'posted') as company,
       (select coalesce(sum(available_balance),0)::int from wallets) as wallets
    `,
  );
  console.log(JSON.stringify({
    ok: true,
    summary: summary.rows[0],
    overCount: over.rows.map((row) => ({
      ...row,
      cap: (RATES[row.level] ?? 0) * (NEED[row.level] ?? 0),
      extra: Number(row.paid) - (RATES[row.level] ?? 0) * (NEED[row.level] ?? 0),
    })),
    heldOnReleasedLevel: heldAfter.rows,
    duplicateReleases: dupRelease.rows,
    graduated: graduated.rows,
    wallets: walletGap.rows,
  }));
} finally {
  client.release();
  await pool.end();
}
