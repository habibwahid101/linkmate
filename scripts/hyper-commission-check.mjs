/**
 * Read-only. Explain Hyper Turbo commission vs wallet. No writes.
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
  const packs = await client.query(
    `select p.id, p.user_id, p.id_count, p.created_at,
            (select count(*)::int from member_ids m where m.purchase_id = p.id) as ids
     from package_purchases p
     where p.package_id = 'hyper_turbo'
     order by p.created_at desc
     limit 5`,
  );
  const rows = [];
  for (const pack of packs.rows) {
    const money = await client.query(
      `select
         coalesce(sum(w.available_balance),0)::int as available,
         coalesce(sum(w.total_released),0)::int as released_wallet,
         coalesce((select sum(amount)::int from held_commissions h
           where h.member_id in (select id from member_ids where purchase_id = $1)),0) as held,
         coalesce((select sum(commission_amount)::int from commission_entries c
           where c.beneficiary_id in (select id from member_ids where purchase_id = $1)
             and c.status = 'RELEASED'),0) as released_entries,
         coalesce((select sum(commission_amount)::int from commission_entries c
           where c.beneficiary_id in (select id from member_ids where purchase_id = $1)
             and c.status = 'HELD'),0) as held_entries,
         coalesce((select count(*)::int from wallet_transactions t
           where t.member_id in (select id from member_ids where purchase_id = $1)
             and t.type = 'RELEASE'),0) as release_tx
       from wallets w
       where w.member_id in (select id from member_ids where purchase_id = $1)`,
      [pack.id],
    );
    const levels = await client.query(
      `select current_level, count(*)::int as n
       from member_ids where purchase_id = $1
       group by current_level order by current_level`,
      [pack.id],
    );
    rows.push({
      ids: pack.ids,
      held: Number(money.rows[0].held),
      held_entries: Number(money.rows[0].held_entries),
      released_entries: Number(money.rows[0].released_entries),
      released_wallet: Number(money.rows[0].released_wallet),
      available: Number(money.rows[0].available),
      release_tx: Number(money.rows[0].release_tx),
      levels: levels.rows,
    });
  }
  console.log(JSON.stringify({ ok: true, packs: rows }));
} finally {
  client.release();
  await pool.end();
}
