-- Idempotent purchase keys and one-release-per-level wallet posts.

create table if not exists purchase_idempotency (
  key text primary key,
  user_id text not null,
  purchase_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists purchase_idempotency_user_idx on purchase_idempotency (user_id);

insert into app_settings (key, value)
values ('bootstrap_admin', 'preview_only')
on conflict (key) do nothing;
