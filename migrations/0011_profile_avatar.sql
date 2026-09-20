-- Profile photograph for the account holder. Display only. No engine impact.
alter table app_users add column if not exists avatar_data text;
