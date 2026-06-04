-- Run this migration in the Supabase SQL editor.
-- It allows authenticated application admins to create and update users.

create or replace function public.app_is_admin()
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
      and ar.role_key = 'admin'
  );
$$;

revoke all on function public.app_is_admin() from public;
grant execute on function public.app_is_admin() to authenticated;

drop policy if exists "Allow insert to admins only" on public.auth_users;
create policy "Allow insert to admins only"
on public.auth_users
for insert
to authenticated
with check (public.app_is_admin());

drop policy if exists "Allow update to admins only" on public.auth_users;
create policy "Allow update to admins only"
on public.auth_users
for update
to authenticated
using (public.app_is_admin())
with check (public.app_is_admin());
