/** Read-only. Why LM-100031 shows no designation. */
import pg from "pg";

if (process.env.CONFIRM !== "READ-DESIGNATION") {
  console.error("Refusing: CONFIRM token missing");
  process.exit(1);
}
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) process.exit(1);

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  const root = await client.query(
    `select m.id, m.origin_kind, m.is_root, m.sponsor_id, m.referral_code, u.email, u.display_name
     from member_ids m
     join app_users u on u.user_id = m.owner_user_id
     where m.id = 'LM-100031' or lower(u.email) = 'haron@gmail.com'
     order by m.created_at`,
  );
  const children = await client.query(
    `select c.id, c.origin_kind, c.is_root, c.package_id, c.owner_user_id = p.owner_user_id as same_owner,
            exists (
              select 1 from sponsor_designation_credits d
              where d.sponsored_id = c.id and d.voided_at is null
            ) as credited
     from member_ids c
     join member_ids p on p.id = c.sponsor_id
     where c.sponsor_id = 'LM-100031'
     order by c.created_at`,
  );
  const counts = await client.query(
    `select
       (select count(*)::int from sponsor_relationships where sponsor_id = 'LM-100031') as sponsor_links,
       (select count(*)::int from sponsor_designation_credits where sponsor_id = 'LM-100031' and voided_at is null) as credits,
       (select count(*)::int from member_ids) as members`,
  );
  const missing = await client.query(
    `select m.id, m.origin_kind, m.is_root, m.sponsor_id
     from member_ids m
     where m.sponsor_id is not null
       and (
         m.origin_kind in ('purchase_root', 'attach')
         or (m.origin_kind = 'purchase' and m.is_root)
       )
       and not exists (
         select 1 from sponsor_designation_credits c
         where c.sponsored_id = m.id and c.voided_at is null
       )
     order by m.created_at
     limit 40`,
  );
  console.log(JSON.stringify({
    counts: counts.rows[0],
    haron: root.rows.map((row) => ({
      id: row.id,
      origin: row.origin_kind,
      root: row.is_root,
      sponsor: row.sponsor_id,
      email: row.email,
    })),
    children: children.rows,
    missingCredits: missing.rows,
  }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "status failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
