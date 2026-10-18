/**
 * Show released commission on the buyer's dashboard.
 * Reassigns only wallets whose ledger already belongs to the ID owner,
 * then sets the balance from that ledger. Does not change commission rows.
 *
 *   CONFIRM=ATTACH-BUYER-WALLETS node scripts/attach-buyer-wallets.mjs --apply
 */
import pg from "pg";

const KEEP = ["LM-100001", "LM-100002", "LM-100003"];
const apply = process.argv.includes("--apply");
if (apply && process.env.CONFIRM !== "ATTACH-BUYER-WALLETS") {
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

async function companyBalances() {
  const rows = await client.query(
    `select id,
            coalesce((select available_balance from wallets w where w.member_id = m.id), 0)::int as available
     from member_ids m where id = any($1::text[]) order by id`,
    [KEEP],
  );
  return rows.rows.map((row) => `${row.id}:${row.available}`).join(",");
}

try {
  const mismatched = await client.query(
    `select w.member_id
     from wallets w
     join member_ids m on m.id = w.member_id
     where w.owner_user_id <> m.owner_user_id
       and m.id <> all($1::text[])
       and not exists (
         select 1 from wallet_transactions t
         where t.member_id = m.id
           and t.owner_user_id <> m.owner_user_id
       )`,
    [KEEP],
  );
  const ids = mismatched.rows.map((row) => row.member_id);
  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "inventory", wallets: ids.length }));
    process.exit(0);
  }
  if (ids.length === 0) throw new Error("Refusing: no mismatched buyer wallets");

  const beforeCompany = await companyBalances();
  const beforeHeld = await client.query(
    `select coalesce(sum(amount),0)::int as held
     from held_commissions where member_id = any($1::text[])`,
    [ids],
  );

  await client.query("begin");
  await client.query(
    `update wallets w
     set owner_user_id = m.owner_user_id, updated_at = now()
     from member_ids m
     where w.member_id = m.id and w.member_id = any($1::text[])`,
    [ids],
  );
  await client.query(
    `update wallets w
     set available_balance = s.available,
         total_released = s.released,
         updated_at = now()
     from (
       select m.id as member_id,
              coalesce(sum(t.amount), 0)::int as available,
              coalesce(sum(t.amount) filter (where t.type in ('RELEASE', 'REVERSAL')), 0)::int as released
       from member_ids m
       left join wallet_transactions t
         on t.member_id = m.id and t.status = 'posted'
       where m.id = any($1::text[])
       group by m.id
     ) s
     where w.member_id = s.member_id`,
    [ids],
  );

  const after = await client.query(
    `select
       count(*) filter (where w.owner_user_id = m.owner_user_id)::int as matched,
       coalesce(sum(w.available_balance),0)::int as available,
       coalesce(sum(w.total_released),0)::int as released
     from wallets w
     join member_ids m on m.id = w.member_id
     where w.member_id = any($1::text[])`,
    [ids],
  );
  const ledger = await client.query(
    `select coalesce(sum(amount),0)::int as amount
     from wallet_transactions
     where member_id = any($1::text[]) and status = 'posted' and type = 'RELEASE'`,
    [ids],
  );
  const held = await client.query(
    `select coalesce(sum(amount),0)::int as held
     from held_commissions where member_id = any($1::text[])`,
    [ids],
  );
  const row = after.rows[0];
  const released = Number(ledger.rows[0].amount);
  if (Number(row.matched) !== ids.length) throw new Error("Refusing: a wallet is still on the wrong account");
  if (Number(row.available) !== released || Number(row.released) !== released) {
    throw new Error("Refusing: balance does not match the release ledger");
  }
  if (Number(held.rows[0].held) !== Number(beforeHeld.rows[0].held)) {
    throw new Error("Refusing: held commission changed");
  }
  if ((await companyBalances()) !== beforeCompany) throw new Error("Refusing: company wallets changed");

  await client.query("commit");
  console.log(JSON.stringify({
    ok: true,
    mode: "apply",
    wallets: ids.length,
    available: Number(row.available),
    released: Number(row.released),
    held: Number(held.rows[0].held),
  }));
} catch (error) {
  try { await client.query("rollback"); } catch { /* not open */ }
  console.error(error instanceof Error ? error.message : "attach failed");
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
