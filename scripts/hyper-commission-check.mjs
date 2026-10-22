/**
 * Read-only: explain large commissions. No writes.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();

try {
  const badAmount = await client.query(
    `select beneficiary_id as id, level, count(*)::int as n,
            coalesce(sum(commission_amount),0)::int as paid,
            round(avg(commission_amount))::int as rate
     from commission_entries
     where status in ('HELD','RELEASED')
     group by beneficiary_id, level, commission_amount
     having commission_amount not in (880,660,330,220,132,110)
     limit 20`,
  );
  const bands = await client.query(
    `select
       count(*) filter (where released = 150546)::int as full_nine,
       count(*) filter (where released = 114906)::int as through_eight,
       count(*) filter (where released > 150546)::int as above_cap,
       count(*) filter (where released > 0)::int as any_release
     from (
       select beneficiary_id, coalesce(sum(commission_amount) filter (where status = 'RELEASED'),0)::int as released
       from commission_entries group by beneficiary_id
     ) s`,
  );
  const top = await client.query(
    `select m.id, m.origin_kind, m.package_id, m.current_level, m.progression_status, m.parent_id,
            coalesce(sum(c.commission_amount) filter (where c.status = 'RELEASED'),0)::int as released,
            coalesce(sum(c.commission_amount) filter (where c.status = 'HELD'),0)::int as held
     from member_ids m
     join commission_entries c on c.beneficiary_id = m.id
     group by m.id
     having coalesce(sum(c.commission_amount) filter (where c.status = 'RELEASED'),0) >= 114906
     order by m.id
     limit 40`,
  );
  const byOrigin = await client.query(
    `select m.origin_kind,
            count(distinct m.id)::int as ids,
            coalesce(sum(c.commission_amount),0)::int as paid
     from commission_entries c
     join member_ids m on m.id = c.beneficiary_id
     where c.status in ('HELD','RELEASED')
     group by m.origin_kind
     order by paid desc`,
  );
  const level9 = await client.query(
    `select lp.status, count(*)::int as ids,
            min(lp.placement_completed_members)::int as min_n,
            max(lp.placement_completed_members)::int as max_n
     from level_progress lp
     where lp.level = 9 and lp.placement_completed_members > 0
     group by lp.status`,
  );
  console.log(JSON.stringify({
    ok: true,
    badAmount: badAmount.rows,
    bands: bands.rows[0],
    byOrigin: byOrigin.rows,
    level9: level9.rows,
    top: top.rows,
  }));
} finally {
  client.release();
  await pool.end();
}
