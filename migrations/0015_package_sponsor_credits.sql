-- Count every activated package ID toward the purchase sponsor's designation.
-- Does not change commissions, wallets, levels, prices, or land qualification.

insert into sponsor_designation_credits (
  id, sponsor_id, sponsored_id, sponsor_owner_user_id, credited_at
)
select
  'desig:' || m.id,
  root.sponsor_id,
  m.id,
  s.owner_user_id,
  coalesce(e.created_at, m.activated_at, m.created_at)
from member_ids m
join member_ids root
  on root.purchase_id = m.purchase_id
 and root.is_root
 and root.sponsor_id is not null
join member_ids s on s.id = root.sponsor_id
join membership_activation_events e on e.member_id = m.id
where m.origin_kind = 'package_internal'
on conflict (sponsored_id) do nothing;
