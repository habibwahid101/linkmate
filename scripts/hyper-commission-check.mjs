/**
 * Read-only policy check for the latest Hyper Turbo purchase. No writes.
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
  const pack = await client.query(
    `select id from package_purchases
     where package_id = 'hyper_turbo'
     order by created_at desc limit 1`,
  );
  const purchaseId = pack.rows[0]?.id;
  if (!purchaseId) {
    console.log(JSON.stringify({ ok: true, found: false }));
    process.exit(0);
  }

  const shape = await client.query(
    `select
       count(*)::int as ids,
       count(*) filter (where placement_status = 'placed')::int as placed,
       count(*) filter (where is_root)::int as roots,
       count(*) filter (where sponsor_id is distinct from parent_id)::int as sponsor_differs_from_placement
     from member_ids where purchase_id = $1`,
    [purchaseId],
  );
  const root = await client.query(
    `select (sponsor_id is distinct from parent_id) as root_sponsor_differs,
            sponsor_id is not null as has_sponsor,
            parent_id is not null as has_placement
     from member_ids where purchase_id = $1 and is_root`,
    [purchaseId],
  );
  const ancestry = await client.query(
    `select coalesce(ancestry_model, 'none') as model, count(*)::int as n
     from membership_activation_events
     where member_id in (select id from member_ids where purchase_id = $1)
     group by 1`,
    [purchaseId],
  );
  const designation = await client.query(
    `select count(*)::int as credits, count(distinct sponsor_id)::int as sponsors
     from sponsor_designation_credits
     where voided_at is null
       and sponsored_id in (select id from member_ids where purchase_id = $1)`,
    [purchaseId],
  );
  const share = await client.query(
    `select member_id, count(*)::int as n, coalesce(sum(amount),0)::int as amount
     from wallet_transactions
     where type = 'COMPANY_SHARE'
       and related_member_id in (select id from member_ids where purchase_id = $1)
     group by member_id
     order by member_id`,
    [purchaseId],
  );
  const exemptLevel = await client.query(
    `select beneficiary_id, count(*)::int as n, coalesce(sum(commission_amount),0)::int as amount
     from commission_entries
     where beneficiary_id in ('LM-100001','LM-100002','LM-100003')
       and source_id in (select id from member_ids where purchase_id = $1)
     group by beneficiary_id
     order by beneficiary_id`,
    [purchaseId],
  );
  const rootLevels = await client.query(
    `select lp.level, lp.placement_completed_members, lp.completed_members,
            lp.required_members, lp.status
     from level_progress lp
     join member_ids m on m.id = lp.member_id
     where m.purchase_id = $1 and m.is_root and lp.level <= 3
     order by lp.level`,
    [purchaseId],
  );
  const money = await client.query(
    `select
       coalesce(sum(commission_amount) filter (where status = 'RELEASED'),0)::int as released,
       coalesce(sum(commission_amount) filter (where status = 'HELD'),0)::int as held
     from commission_entries
     where beneficiary_id in (select id from member_ids where purchase_id = $1)`,
    [purchaseId],
  );

  const owners = await client.query(
    `select
       count(*) filter (where w.owner_user_id = m.owner_user_id)::int as wallet_matches_member,
       count(*) filter (where w.owner_user_id = p.user_id)::int as wallet_matches_buyer,
       count(*) filter (where m.owner_user_id = p.user_id)::int as member_matches_buyer,
       count(*) filter (where u.role = 'admin')::int as wallet_owner_admin,
       count(distinct w.owner_user_id)::int as wallet_owners
     from member_ids m
     join package_purchases p on p.id = m.purchase_id
     left join wallets w on w.member_id = m.id
     left join app_users u on u.user_id = w.owner_user_id
     where m.purchase_id = $1`,
    [purchaseId],
  );
  const tx = await client.query(
    `select t.type, t.status, count(*)::int as n, coalesce(sum(t.amount),0)::int as amount,
            count(*) filter (where t.owner_user_id = m.owner_user_id)::int as owner_matches_member
     from wallet_transactions t
     join member_ids m on m.id = t.member_id
     where m.purchase_id = $1
     group by t.type, t.status
     order by t.type`,
    [purchaseId],
  );

  console.log(JSON.stringify({
    ok: true,
    found: true,
    owners: owners.rows[0],
    tx: tx.rows,
    packageCommission: money.rows[0],
  }));
} finally {
  client.release();
  await pool.end();
}
