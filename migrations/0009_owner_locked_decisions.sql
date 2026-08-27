-- Owner-locked payout, tax, land, and Hyper Turbo placement decisions.

insert into app_settings (key, value)
values
  ('withdrawal_payout_schedule', 'Manual payout within 1–3 business days after admin approval.'),
  ('withdrawal_tax_policy', 'No fixed platform tax deduction. Statutory tax follows prevailing law and accounting policy.'),
  ('land_operational_status', 'Qualification Track Active — Transfer subject to final documentation/allocation terms.'),
  ('hyper_turbo_placement_version', 'v2-middle-sponsors-final-9')
on conflict (key) do update
  set value = excluded.value, updated_at = now();

update packages
set placement_rule_version = 'v2-middle-sponsors-final-9',
    structure_summary = '22 IDs — 1 root + 3 + 9, then the middle ID of each gen-2 group sponsors 3 of the final 9.',
    receives = 'Twenty-two IDs. All are placed: 1 root, 3 under the root, 9 under those, and 9 under the middle ID of each trio.',
    updated_at = now()
where id = 'hyper_turbo';
