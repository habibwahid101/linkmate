-- Owner-approved payout policy knobs.
-- Min 500 BDT. Fee is 5% stored as basis points (500).
-- Existing withdrawal_fee_bdt remains as a unused flat-fee fallback (0).

insert into app_settings (key, value)
values
  ('withdrawal_min_bdt', '500'),
  ('withdrawal_fee_bps', '500'),
  ('withdrawal_fee_bdt', '0')
on conflict (key) do update
  set value = excluded.value, updated_at = now();
