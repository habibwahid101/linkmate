-- Production hardening: rate limits + Postgres-backed purchase idempotency
-- already exists in 0003. Advisory locks are used at runtime (not schema).

create table if not exists rate_limits (
  key text primary key,
  hits integer not null,
  window_start timestamptz not null
);

create index if not exists rate_limits_window_idx on rate_limits (window_start);
