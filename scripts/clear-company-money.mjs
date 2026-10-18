/**
 * Zero balance and commission on the three company IDs.
 * Does not delete the IDs, their logins, sponsor links, or the 1% rule.
 *
 *   node scripts/clear-company-money.mjs
 *   CONFIRM=CLEAR-COMPANY-MONEY node scripts/clear-company-money.mjs --apply
 */
import pg from "pg";

const IDS = ["LM-100001", "LM-100002", "LM-100003"];
const apply = process.argv.includes("--apply");
if (apply && process.env.CONFIRM !== "CLEAR-COMPANY-MONEY") {
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

function n(result) {
  return Number(result.rowCount ?? 0);
}

async function money() {
  const rows = await client.query(
    `select m.id, m.origin_kind, m.sponsor_id, m.parent_id, m.current_level,
            coalesce(w.available_balance, 0)::int as available,
            coalesce(w.total_released, 0)::int as released,
            coalesce((select sum(amount)::int from held_commissions h where h.member_id = m.id), 0) as held,
            coalesce((select count(*)::int from commission_entries c where c.beneficiary_id = m.id), 0) as commissions,
            coalesce((select count(*)::int from wallet_transactions t where t.member_id = m.id), 0) as transactions
     from member_ids m
     left join wallets w on w.member_id = m.id
     where m.id = any($1::text[])
     order by m.id`,
    [IDS],
  );
  const members = await client.query(`select count(*)::int as n from member_ids`);
  return { rows: rows.rows, members: Number(members.rows[0].n) };
}

try {
  const before = await money();
  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "inventory", ...before }));
    process.exit(0);
  }
  if (before.members !== 3 || before.rows.length !== 3) {
    throw new Error("Refusing: expected only the three company IDs");
  }
  if (before.rows.some((row) => row.origin_kind !== "company_seed")) {
    throw new Error("Refusing: a company ID is not a seed");
  }

  await client.query("begin");
  const deleted = {};
  deleted.impacts = n(await client.query(
    `delete from membership_activation_impacts where beneficiary_id = any($1::text[])`,
    [IDS],
  ));
  deleted.commissions = n(await client.query(
    `delete from commission_entries where beneficiary_id = any($1::text[])`,
    [IDS],
  ));
  deleted.held = n(await client.query(
    `delete from held_commissions where member_id = any($1::text[])`,
    [IDS],
  ));
  deleted.transactions = n(await client.query(
    `delete from wallet_transactions where member_id = any($1::text[])`,
    [IDS],
  ));
  deleted.wallets = n(await client.query(
    `update wallets set available_balance = 0, total_released = 0, updated_at = now()
     where member_id = any($1::text[])`,
    [IDS],
  ));
  deleted.levels = n(await client.query(
    `update level_progress set
       completed_members = 0,
       placement_completed_members = 0,
       remaining_members = required_members,
       accumulated_commission = 0,
       status = case when level = 1 then 'IN_PROGRESS' else 'LOCKED' end,
       completed_at = null,
       released_at = null
     where member_id = any($1::text[])`,
    [IDS],
  ));
  await client.query(
    `update member_ids set current_level = 1, progression_status = 'ACTIVE'
     where id = any($1::text[])`,
    [IDS],
  );

  const after = await money();
  if (after.members !== 3 || after.rows.length !== 3) throw new Error("Refusing: ID set changed");
  for (const row of after.rows) {
    const prior = before.rows.find((item) => item.id === row.id);
    if (!prior) throw new Error("Refusing: a company ID disappeared");
    if (row.origin_kind !== prior.origin_kind || row.sponsor_id !== prior.sponsor_id || row.parent_id !== prior.parent_id) {
      throw new Error("Refusing: sponsor or placement changed");
    }
    if (Number(row.available) !== 0 || Number(row.released) !== 0 || Number(row.held) !== 0) {
      throw new Error("Refusing: balance remains");
    }
    if (Number(row.commissions) !== 0 || Number(row.transactions) !== 0) {
      throw new Error("Refusing: commission rows remain");
    }
  }
  await client.query("commit");
  console.log(JSON.stringify({
    ok: true,
    mode: "apply",
    deleted,
    kept: after.rows.map((row) => ({
      id: row.id,
      available: Number(row.available),
      released: Number(row.released),
      held: Number(row.held),
      sponsor: row.sponsor_id,
      parent: row.parent_id,
    })),
  }));
} catch (error) {
  try { await client.query("rollback"); } catch { /* not open */ }
  console.error(error instanceof Error ? error.message : "clear failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
