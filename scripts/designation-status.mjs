/** Read-only designation status. Changes nothing. */
import pg from "pg";

if (process.env.CONFIRM !== "READ-DESIGNATION") {
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
  const summary = await client.query(
    `select
       (select count(*)::int from member_ids) as members,
       (select count(*)::int from sponsor_relationships) as sponsor_links,
       (select count(*)::int from sponsor_designation_credits where voided_at is null) as credits`,
  );
  const bySponsor = await client.query(
    `select m.id, m.referral_code, m.origin_kind,
            (select count(*)::int from sponsor_relationships sr where sr.sponsor_id = m.id) as sponsor_children,
            (select count(*)::int from sponsor_designation_credits c
              where c.sponsor_id = m.id and c.voided_at is null) as credits
     from member_ids m
     order by m.created_at
     limit 30`,
  );
  const missing = await client.query(
    `select m.id, m.origin_kind, m.sponsor_id, m.is_root
     from member_ids m
     where m.sponsor_id is not null
       and m.origin_kind in ('purchase_root', 'attach', 'purchase')
       and not exists (
         select 1 from sponsor_designation_credits c
         where c.sponsored_id = m.id and c.voided_at is null
       )
     order by m.created_at
     limit 30`,
  );
  console.log(JSON.stringify({ summary: summary.rows[0], ids: bySponsor.rows, missingCredits: missing.rows }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "status failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
