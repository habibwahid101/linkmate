-- Step 2 prep. Additive only. Does not turn placement rules on and does not
-- update commission amounts, statuses, wallets, releases, or level counts.

alter table membership_activation_events
  add column if not exists ancestry_model text not null default 'sponsor';

alter table commission_entries
  add column if not exists ancestry_model text not null default 'sponsor';

alter table level_progress
  add column if not exists placement_completed_members integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activation_events_ancestry_model_chk'
  ) then
    alter table membership_activation_events
      add constraint activation_events_ancestry_model_chk
      check (ancestry_model in ('sponsor', 'placement'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'commission_entries_ancestry_model_chk'
  ) then
    alter table commission_entries
      add constraint commission_entries_ancestry_model_chk
      check (ancestry_model in ('sponsor', 'placement'));
  end if;
end $$;

-- Empty means the sponsor walk is still in force. Do not set a timestamp here.
insert into app_settings (key, value)
values ('placement_rules_cutover_at', '')
on conflict (key) do nothing;
