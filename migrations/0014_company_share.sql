-- Company share is off until an admin sets a percent and member IDs.
-- Empty values do not pay anyone and do not change level rates or wallets.

insert into app_settings (key, value)
values
  ('company_share_percent', ''),
  ('company_share_member_ids', ''),
  ('company_level_exempt_member_ids', '')
on conflict (key) do nothing;
