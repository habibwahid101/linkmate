/**
 * Read-only check for Sheikh's Hyper Turbo account. No writes.
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
  const owner = await client.query(
    `select owner_user_id from member_ids where id = 'LM-100004'`,
  );
  const userId = owner.rows[0]?.owner_user_id;
  if (!userId) {
    console.log(JSON.stringify({ ok: false, reason: "missing" }));
    process.exit(0);
  }
  const money = await client.query(
    `select count(*)::int as ids,
            coalesce(sum(w.available_balance),0)::int as available,
            coalesce(sum(w.total_released),0)::int as released,
            coalesce((select sum(h.amount)::int from held_commissions h
              join member_ids m on m.id = h.member_id
              where m.owner_user_id = $1),0) as held
     from member_ids m
     left join wallets w on w.member_id = m.id
     where m.owner_user_id = $1`,
    [userId],
  );
  const credits = await client.query(
    `select m.id, m.is_root, m.origin_kind, count(c.sponsored_id)::int as credits
     from member_ids m
     left join sponsor_designation_credits c
       on c.sponsor_id = m.id and c.voided_at is null
     where m.owner_user_id = $1
     group by m.id, m.is_root, m.origin_kind
     having count(c.sponsored_id) > 0
     order by credits desc`,
    [userId],
  );
  const purchase = await client.query(
    `select p.id from package_purchases p
     where p.user_id = $1 and p.package_id = 'hyper_turbo'
     order by p.created_at desc limit 1`,
    [userId],
  );
  const purchaseId = purchase.rows[0]?.id ?? null;
  const given = purchaseId
    ? await client.query(
        `select sponsor_id, count(*)::int as credits
         from sponsor_designation_credits
         where voided_at is null
           and sponsored_id in (select id from member_ids where purchase_id = $1)
         group by sponsor_id`,
        [purchaseId],
      )
    : { rows: [] };
  const rootLevels = await client.query(
    `select lp.level, lp.placement_completed_members, lp.required_members, lp.status,
            lp.accumulated_commission::int as accumulated
     from level_progress lp
     join member_ids m on m.id = lp.member_id
     where m.owner_user_id = $1 and m.is_root and lp.level <= 4
     order by m.id, lp.level`,
    [userId],
  );
  const byStatus = await client.query(
    `select status, count(*)::int as n, coalesce(sum(commission_amount),0)::int as amount
     from commission_entries
     where beneficiary_id in (select id from member_ids where owner_user_id = $1)
     group by status`,
    [userId],
  );
  console.log(JSON.stringify({
    ok: true,
    money: money.rows[0],
    ownCredits: credits.rows,
    purchaseCreditsGivenTo: given.rows,
    rootLevels: rootLevels.rows,
    commissions: byStatus.rows,
  }));
} finally {
  client.release();
  await pool.end();
}
