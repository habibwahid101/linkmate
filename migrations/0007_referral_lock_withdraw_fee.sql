-- Server-side intended sponsor attribution (immutable once set).
-- Withdrawal fee stored so reject can restore amount + fee.

alter table app_users
  add column if not exists intended_referral_code text;

alter table app_users
  add column if not exists intended_sponsor_user_id text;

create index if not exists app_users_intended_ref_idx
  on app_users (intended_referral_code)
  where intended_referral_code is not null;

alter table if exists withdrawal_requests
  add column if not exists fee_bdt integer not null default 0;
