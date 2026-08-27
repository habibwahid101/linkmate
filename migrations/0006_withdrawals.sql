-- Manual commission withdrawals. Amounts are integer BDT.
-- Policy knobs default to 0 = OWNER CONFIGURATION REQUIRED (no invented fee/min).

create table if not exists withdrawal_requests (
  id text primary key,
  owner_user_id text not null references app_users(user_id),
  member_id text not null,
  amount_bdt integer not null check (amount_bdt > 0),
  payout_method text not null,
  payout_details jsonb not null default '{}'::jsonb,
  status text not null,
  user_note text,
  admin_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  paid_at timestamptz,
  reserve_tx_id text,
  restore_tx_id text,
  paid_tx_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawal_owner_idx on withdrawal_requests (owner_user_id, created_at desc);
create index if not exists withdrawal_status_idx on withdrawal_requests (status, created_at desc);
create unique index if not exists withdrawal_one_open_idx
  on withdrawal_requests (owner_user_id)
  where status in ('PENDING', 'APPROVED', 'PROCESSING');

insert into app_settings (key, value)
values
  ('withdrawal_min_bdt', '0'),
  ('withdrawal_fee_bdt', '0')
on conflict (key) do nothing;
