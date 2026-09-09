-- Batch 2: ID-based progression / commission engine.
-- Production business tables are empty. Idempotent. Does not drop data.

alter table member_ids
  add column if not exists referral_code text,
  add column if not exists current_level integer not null default 1,
  add column if not exists progression_status text not null default 'ACTIVE',
  add column if not exists activated_at timestamptz,
  add column if not exists origin_kind text not null default 'purchase';

create unique index if not exists member_ids_referral_code_uq
  on member_ids (referral_code)
  where referral_code is not null;

create index if not exists member_ids_referral_lookup_idx
  on member_ids (upper(referral_code))
  where referral_code is not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'member_ids_no_self_sponsor') then
    alter table member_ids
      add constraint member_ids_no_self_sponsor
      check (sponsor_id is null or sponsor_id <> id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'member_ids_current_level_chk') then
    alter table member_ids
      add constraint member_ids_current_level_chk
      check (current_level between 1 and 9);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'member_ids_progression_status_chk') then
    alter table member_ids
      add constraint member_ids_progression_status_chk
      check (progression_status in ('ACTIVE', 'GRADUATED'));
  end if;
end $$;

-- Immutable activation of a Membership ID. member_id unique => replay-safe.
create table if not exists membership_activation_events (
  id text primary key,
  member_id text not null unique,
  owner_user_id text not null,
  sponsor_id text,
  joining_amount_bdt integer not null,
  created_at timestamptz not null default now()
);

-- One progress/commission impact per (activation, beneficiary).
create table if not exists membership_activation_impacts (
  id text primary key,
  event_id text not null references membership_activation_events (id),
  beneficiary_id text not null,
  beneficiary_owner_user_id text not null,
  level integer not null,
  kind text not null,
  commission_entry_id text,
  created_at timestamptz not null default now(),
  unique (event_id, beneficiary_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activation_impacts_level_chk') then
    alter table membership_activation_impacts
      add constraint activation_impacts_level_chk
      check (level between 1 and 9);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activation_impacts_kind_chk') then
    alter table membership_activation_impacts
      add constraint activation_impacts_kind_chk
      check (kind in ('L1_DIRECT', 'DOWNLINE'));
  end if;
end $$;

create index if not exists activation_impacts_ben_idx
  on membership_activation_impacts (beneficiary_id, level);

create unique index if not exists commission_entries_source_beneficiary_uq
  on commission_entries (source_id, beneficiary_id)
  where status in ('HELD', 'RELEASED');

create index if not exists sponsor_rel_pair_idx
  on sponsor_relationships (sponsor_id, sponsored_id);

insert into app_settings (key, value)
values ('progression_model', 'id_current_active_level_v2')
on conflict (key) do nothing;
