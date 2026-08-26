-- Manual payment requests. Forward-only. Does not seed demo users or alter locked rules.

create table if not exists payment_method_settings (
  method text primary key,
  enabled boolean not null default true,
  number text,
  account_type text,
  bank_name text,
  account_name text,
  account_number text,
  branch text,
  routing_number text,
  swift text,
  instructions text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into payment_method_settings (method, enabled, instructions)
values
  ('BKASH', true, 'Send the exact package amount to the bKash number. Copy the Transaction ID and submit it here for admin verification.'),
  ('NAGAD', true, 'Send the exact package amount to the Nagad number. Copy the Transaction ID and submit it here for admin verification.'),
  ('BANK', true, 'Transfer the exact package amount to the account below. Use your membership name as the reference if possible.'),
  ('CASH', true, 'Pay the exact package amount in cash as instructed. An administrator must verify the payment before activation.')
on conflict (method) do nothing;

create table if not exists payment_requests (
  id text primary key,
  user_id text not null references app_users(user_id),
  package_id text not null references packages(id),
  expected_amount_bdt integer not null,
  submitted_amount_bdt integer not null,
  payment_method text not null,
  transaction_reference text,
  transaction_reference_norm text,
  user_note text,
  extra jsonb not null default '{}'::jsonb,
  proof_reference text,
  duplicate_suspect boolean not null default false,
  status text not null default 'PENDING',
  admin_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  purchase_id text references package_purchases(id),
  approval_event_id text unique,
  referral_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_requests_method_chk check (payment_method in ('BKASH', 'NAGAD', 'BANK', 'CASH')),
  constraint payment_requests_status_chk check (status in ('PENDING', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED'))
);

create index if not exists payment_requests_user_idx on payment_requests (user_id, created_at desc);
create index if not exists payment_requests_status_idx on payment_requests (status, created_at desc);
create index if not exists payment_requests_ref_idx on payment_requests (payment_method, transaction_reference_norm);

create unique index if not exists payment_requests_approved_ref_uq
  on payment_requests (payment_method, transaction_reference_norm)
  where status = 'APPROVED'
    and transaction_reference_norm is not null
    and payment_method <> 'CASH';

alter table package_purchases add column if not exists payment_request_id text;
