-- Development-only access reset.
-- Run this in Supabase SQL Editor if the React app receives [] from every table.
-- This makes the public schema visible to the browser publishable/anon key.
-- Do not use this in production with real credential data.

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter default privileges in schema public
grant select, insert, update, delete on tables to anon, authenticated;

alter default privileges in schema public
grant usage, select on sequences to anon, authenticated;

alter table if exists orgs disable row level security;
alter table if exists people disable row level security;
alter table if exists systems disable row level security;
alter table if exists accounts disable row level security;
alter table if exists account_kv disable row level security;
alter table if exists audit_log disable row level security;
alter table if exists auth_roles disable row level security;
alter table if exists auth_users disable row level security;
alter table if exists auth_login_attempts disable row level security;
alter table if exists inbox_messages disable row level security;
alter table if exists vault_secrets disable row level security;
