-- Link Mate core schema. Money is integer BDT. user_id is TEXT (Better Auth).

create sequence if not exists member_id_seq start 100001;

create table if not exists packages (
  id text primary key,
  name text not null,
  amount_bdt integer not null,
  id_count integer not null,
  placement_rule_version text not null default 'v1',
  structure_summary text not null,
  receives text not null,
  active boolean not null default true,
  locked boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists commission_rules (
  id serial primary key,
  level integer not null unique,
  generation integer not null,
  generation_label text not null,
  required_member_count integer not null,
  rate numeric(6,4) not null,
  status text not null default 'active',
  version integer not null default 1
);

create table if not exists app_users (
  user_id text primary key,
  display_name text not null,
  email text,
  phone text,
  phone_verified boolean not null default false,
  role text not null default 'member',
  referral_code text not null unique,
  is_synthetic boolean not null default false,
  active_id text,
  created_at timestamptz not null default now()
);

create index if not exists app_users_role_idx on app_users (role);
create index if not exists app_users_referral_idx on app_users (referral_code);

create table if not exists package_purchases (
  id text primary key,
  user_id text not null,
  package_id text not null references packages(id),
  amount_bdt integer not null,
  id_count integer not null,
  root_id text,
  referral_code text,
  sponsor_member_id text,
  payment_status text not null default 'completed',
  created_at timestamptz not null default now()
);

create index if not exists purchases_user_idx on package_purchases (user_id);

create table if not exists payments (
  id text primary key,
  purchase_id text not null references package_purchases(id),
  amount_bdt integer not null,
  method text not null default 'simulated',
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

create table if not exists user_packages (
  id text primary key,
  user_id text not null,
  package_id text not null references packages(id),
  purchase_id text not null references package_purchases(id),
  created_at timestamptz not null default now()
);

create table if not exists member_ids (
  id text primary key,
  owner_user_id text not null references app_users(user_id),
  package_id text not null references packages(id),
  purchase_id text,
  is_root boolean not null default false,
  sponsor_id text,
  parent_id text,
  placement_status text not null default 'placed',
  status text not null default 'active',
  joining_amount_bdt integer not null default 11000,
  created_at timestamptz not null default now()
);

create index if not exists member_ids_owner_idx on member_ids (owner_user_id);
create index if not exists member_ids_sponsor_idx on member_ids (sponsor_id);
create index if not exists member_ids_parent_idx on member_ids (parent_id);

create table if not exists sponsor_relationships (
  id text primary key,
  sponsor_id text not null,
  sponsored_id text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists sponsor_rel_sponsor_idx on sponsor_relationships (sponsor_id);

create table if not exists placement_relationships (
  id text primary key,
  parent_id text not null,
  child_id text not null unique,
  position integer,
  created_at timestamptz not null default now()
);

create index if not exists placement_parent_idx on placement_relationships (parent_id);

create table if not exists generation_memberships (
  id text primary key,
  beneficiary_id text not null,
  member_id text not null,
  generation integer not null,
  unique (beneficiary_id, member_id)
);

create index if not exists gen_ben_idx on generation_memberships (beneficiary_id, generation);

create table if not exists level_progress (
  id text primary key,
  member_id text not null,
  level integer not null,
  generation integer not null,
  required_members integer not null,
  completed_members integer not null default 0,
  remaining_members integer not null,
  accumulated_commission integer not null default 0,
  expected_full_commission integer not null,
  status text not null default 'LOCKED',
  completed_at timestamptz,
  released_at timestamptz,
  unique (member_id, level)
);

create index if not exists level_progress_member_idx on level_progress (member_id);

create table if not exists commission_entries (
  id text primary key,
  event_id text not null unique,
  beneficiary_user_id text not null,
  beneficiary_id text not null,
  source_user_id text not null,
  source_id text not null,
  source_joining_amount integer not null,
  generation integer not null,
  level integer not null,
  commission_rate numeric(6,4) not null,
  commission_amount integer not null,
  status text not null,
  held_at timestamptz not null default now(),
  released_at timestamptz,
  wallet_transaction_id text,
  rule_version integer not null default 1
);

create index if not exists comm_ben_idx on commission_entries (beneficiary_id, status);
create index if not exists comm_user_idx on commission_entries (beneficiary_user_id);

create table if not exists held_commissions (
  member_id text not null,
  owner_user_id text not null,
  level integer not null,
  amount integer not null default 0,
  primary key (member_id, level)
);

create table if not exists wallets (
  member_id text primary key,
  owner_user_id text not null,
  available_balance integer not null default 0,
  total_released integer not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists wallets_owner_idx on wallets (owner_user_id);

create table if not exists wallet_transactions (
  id text primary key,
  member_id text not null,
  owner_user_id text not null,
  type text not null,
  amount integer not null,
  source text not null,
  level integer,
  generation integer,
  related_member_id text,
  commission_entry_id text,
  status text not null default 'posted',
  created_at timestamptz not null default now()
);

create index if not exists wallet_tx_member_idx on wallet_transactions (member_id, created_at desc);
create index if not exists wallet_tx_user_idx on wallet_transactions (owner_user_id, created_at desc);

create table if not exists notifications (
  id text primary key,
  user_id text not null,
  title text not null,
  body text not null,
  kind text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notif_user_idx on notifications (user_id, created_at desc);

create table if not exists audit_logs (
  id text primary key,
  actor_user_id text,
  action text not null,
  entity_type text not null,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists audit_created_idx on audit_logs (created_at desc);

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Locked package + commission seed
insert into packages (id, name, amount_bdt, id_count, placement_rule_version, structure_summary, receives, locked)
values
  ('builder', 'Builder', 11000, 1, 'v1',
   '1 ID. You are the root. Level 1 requires 3 personal sponsors.',
   'One membership ID. Invite 3 direct members to complete Level 1.', true),
  ('turbo', 'Turbo', 44000, 4, 'v1',
   '4 IDs — 1 root ID + 3 internal Level-1 IDs.',
   'Four IDs. Your first ID internally sponsors the other three, which can complete its Level 1.', true),
  ('super_turbo', 'Super Turbo', 143000, 13, 'v1',
   '13 IDs — 1 root + 3 first generation + 9 second generation.',
   'Thirteen IDs placed as 1 root, 3 under the root, and 9 under those positions.', true),
  ('hyper_turbo', 'Hyper Turbo', 242000, 22, 'v2-middle-sponsors-final-9',
   '22 IDs — 1 root + 3 + 9, then the middle ID of each gen-2 group sponsors 3 of the final 9.',
   'Twenty-two IDs. All are placed: 1 root, 3 under the root, 9 under those, and 9 under the middle ID of each trio.', true)
on conflict (id) do nothing;

insert into commission_rules (level, generation, generation_label, required_member_count, rate, version)
values
  (1, 1, '1st', 3, 0.0800, 1),
  (2, 2, '2nd', 9, 0.0600, 1),
  (3, 3, '3rd', 27, 0.0300, 1),
  (4, 4, '4th', 54, 0.0200, 1),
  (5, 5, '5th', 108, 0.0120, 1),
  (6, 6, '6th', 162, 0.0100, 1),
  (7, 7, '7th', 216, 0.0100, 1),
  (8, 8, '8th', 270, 0.0100, 1),
  (9, 9, '9th', 324, 0.0100, 1)
on conflict (level) do nothing;

insert into app_settings (key, value)
values
  ('hyper_turbo_placement_version', 'v2-middle-sponsors-final-9'),
  ('standard_id_value_bdt', '11000'),
  ('rule_version', '1')
on conflict (key) do nothing;
