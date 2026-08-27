#!/usr/bin/env node
/**
 * Persist owner-approved receiving accounts and withdrawal policy.
 * Idempotent. Does not invent extra methods or change locked commission rules.
 */
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const BKASH_NAGAD = "+880 1719-309326";
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

try {
  await pool.query(
    `insert into app_settings (key, value, updated_at)
     values
       ('withdrawal_min_bdt', '500', now()),
       ('withdrawal_fee_bps', '500', now()),
       ('withdrawal_fee_bdt', '0', now()),
       ('withdrawal_payout_schedule', 'Manual payout within 1–3 business days after admin approval.', now()),
       ('withdrawal_tax_policy', 'No fixed platform tax deduction. Statutory tax follows prevailing law and accounting policy.', now()),
       ('land_operational_status', 'Qualification Track Active — Transfer subject to final documentation/allocation terms.', now()),
       ('hyper_turbo_placement_version', 'v2-middle-sponsors-final-9', now())
     on conflict (key) do update
       set value = excluded.value, updated_at = now()`,
  );

  await pool.query(
    `update payment_method_settings
     set enabled = true,
         number = $1,
         account_type = 'Personal',
         instructions = 'Send the exact package amount to this Personal bKash number. Copy the Transaction ID and submit it for admin verification.',
         updated_at = now()
     where method = 'BKASH'`,
    [BKASH_NAGAD],
  );
  await pool.query(
    `update payment_method_settings
     set enabled = true,
         number = $1,
         account_type = 'Personal',
         instructions = 'Send the exact package amount to this Personal Nagad number. Copy the Transaction ID and submit it for admin verification.',
         updated_at = now()
     where method = 'NAGAD'`,
    [BKASH_NAGAD],
  );
  await pool.query(
    `update payment_method_settings
     set enabled = false,
         number = null,
         account_type = null,
         bank_name = null,
         account_name = null,
         account_number = null,
         branch = null,
         routing_number = null,
         swift = null,
         instructions = 'Bank transfer is not configured.',
         updated_at = now()
     where method = 'BANK'`,
  );
  await pool.query(
    `update payment_method_settings
     set enabled = true,
         instructions = 'Cash is accepted. Record collector name and payment date. Submission does not activate membership; only admin approval does.',
         updated_at = now()
     where method = 'CASH'`,
  );

  const settings = await pool.query(
    `select key, value from app_settings where key in (
        'withdrawal_min_bdt','withdrawal_fee_bps','withdrawal_fee_bdt',
        'withdrawal_payout_schedule','withdrawal_tax_policy','land_operational_status',
        'hyper_turbo_placement_version'
      ) order by key`,
  );
  const methods = await pool.query(
    `select method, enabled, number, account_type from payment_method_settings order by method`,
  );
  console.log("Owner payout settings:");
  for (const row of settings.rows) console.log(`  ${row.key}=${row.value}`);
  for (const row of methods.rows) {
    console.log(`  ${row.method} enabled=${row.enabled} number=${row.number ?? ""} type=${row.account_type ?? ""}`);
  }
} finally {
  await pool.end();
}
