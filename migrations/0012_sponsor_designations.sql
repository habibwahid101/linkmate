-- Step 1 of the sponsor/placement change.
-- Display-only designation credits. Does not alter commissions, wallets,
-- level progress, packages, or land qualification.

create table if not exists sponsor_designation_credits (
  id text primary key,
  sponsor_id text not null,
  sponsored_id text not null,
  sponsor_owner_user_id text not null,
  credited_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text
);

create unique index if not exists sponsor_designation_credits_sponsored_uq
  on sponsor_designation_credits (sponsored_id);

create index if not exists sponsor_designation_credits_sponsor_idx
  on sponsor_designation_credits (sponsor_id)
  where voided_at is null;

-- One credit per already-activated external root. Package-internal IDs are excluded.
-- Idempotent. Does not update any ledger table.
insert into sponsor_designation_credits (
  id, sponsor_id, sponsored_id, sponsor_owner_user_id, credited_at
)
select
  'desig:' || m.id,
  m.sponsor_id,
  m.id,
  s.owner_user_id,
  coalesce(e.created_at, m.activated_at, m.created_at)
from member_ids m
join member_ids s on s.id = m.sponsor_id
join membership_activation_events e on e.member_id = m.id
where m.sponsor_id is not null
  and m.origin_kind is distinct from 'package_internal'
  and (
    m.origin_kind in ('purchase_root', 'attach')
    or (m.origin_kind = 'purchase' and m.is_root)
  )
on conflict (sponsored_id) do nothing;
