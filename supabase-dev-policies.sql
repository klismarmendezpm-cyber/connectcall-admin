-- Development-only RLS policies for the current React client.
-- This app uses a custom auth_users login, so browser requests run as `anon`.
-- Do not use these permissive policies in production with real credentials.

alter table orgs enable row level security;
alter table people enable row level security;
alter table systems enable row level security;
alter table accounts enable row level security;
alter table account_kv enable row level security;
alter table audit_log enable row level security;
alter table auth_roles enable row level security;
alter table auth_users enable row level security;
alter table auth_login_attempts enable row level security;
alter table inbox_messages enable row level security;
alter table vault_secrets enable row level security;

drop policy if exists "dev anon all orgs" on orgs;
drop policy if exists "dev anon all people" on people;
drop policy if exists "dev anon all systems" on systems;
drop policy if exists "dev anon all accounts" on accounts;
drop policy if exists "dev anon all account_kv" on account_kv;
drop policy if exists "dev anon all audit_log" on audit_log;
drop policy if exists "dev anon all auth_roles" on auth_roles;
drop policy if exists "dev anon all auth_users" on auth_users;
drop policy if exists "dev anon all auth_login_attempts" on auth_login_attempts;
drop policy if exists "dev anon all inbox_messages" on inbox_messages;
drop policy if exists "dev anon all vault_secrets" on vault_secrets;

create policy "dev anon all orgs"
on orgs for all to anon
using (true)
with check (true);

create policy "dev anon all people"
on people for all to anon
using (true)
with check (true);

create policy "dev anon all systems"
on systems for all to anon
using (true)
with check (true);

create policy "dev anon all accounts"
on accounts for all to anon
using (true)
with check (true);

create policy "dev anon all account_kv"
on account_kv for all to anon
using (true)
with check (true);

create policy "dev anon all audit_log"
on audit_log for all to anon
using (true)
with check (true);

create policy "dev anon all auth_roles"
on auth_roles for all to anon
using (true)
with check (true);

create policy "dev anon all auth_users"
on auth_users for all to anon
using (true)
with check (true);

create policy "dev anon all auth_login_attempts"
on auth_login_attempts for all to anon
using (true)
with check (true);

create policy "dev anon all inbox_messages"
on inbox_messages for all to anon
using (true)
with check (true);

create policy "dev anon all vault_secrets"
on vault_secrets for all to anon
using (true)
with check (true);
