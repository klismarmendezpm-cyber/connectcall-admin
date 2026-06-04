-- Run this migration in the Supabase SQL editor.
-- Managers can manage people and accounts, but organizations and systems are
-- read-only for them. Administrators retain full access.

create or replace function public.app_has_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.auth_users au
    join public.auth_roles ar on ar.role_id = au.role_id
    where lower(au.email) = lower(auth.jwt() ->> 'email')
      and ar.role_key = any(allowed_roles)
  );
$$;

revoke all on function public.app_has_role(text[]) from public;
grant execute on function public.app_has_role(text[]) to authenticated;

-- Remove broad write policies before applying the narrower role rules.
drop policy if exists "Allow insert/update/delete to admins and managers" on public.orgs;
drop policy if exists "Allow insert/update/delete to admins and managers" on public.systems;
drop policy if exists "Allow insert/update/delete to admins and managers" on public.people;
drop policy if exists "Allow insert/update/delete to admins and managers" on public.accounts;
drop policy if exists "Allow insert/update/delete to admins and managers" on public.person_org_assignments;
drop policy if exists "Allow writes to admins only" on public.orgs;
drop policy if exists "Allow writes to admins only" on public.systems;
drop policy if exists "Allow writes to admins and managers" on public.people;
drop policy if exists "Allow writes to admins and managers" on public.accounts;
drop policy if exists "Allow writes to admins and managers" on public.person_org_assignments;

create policy "Allow writes to admins only"
on public.orgs
for all
to authenticated
using (public.app_has_role(array['admin']))
with check (public.app_has_role(array['admin']));

create policy "Allow writes to admins only"
on public.systems
for all
to authenticated
using (public.app_has_role(array['admin']))
with check (public.app_has_role(array['admin']));

create policy "Allow writes to admins and managers"
on public.people
for all
to authenticated
using (public.app_has_role(array['admin', 'manager']))
with check (public.app_has_role(array['admin', 'manager']));

create policy "Allow writes to admins and managers"
on public.accounts
for all
to authenticated
using (public.app_has_role(array['admin', 'manager']))
with check (public.app_has_role(array['admin', 'manager']));

create policy "Allow writes to admins and managers"
on public.person_org_assignments
for all
to authenticated
using (public.app_has_role(array['admin', 'manager']))
with check (public.app_has_role(array['admin', 'manager']));
