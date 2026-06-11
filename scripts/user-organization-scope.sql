-- Run this migration in the Supabase SQL editor.
-- Users can be assigned to multiple organizations. Non-admin users only see
-- people/accounts connected to at least one of their assigned organizations.

alter table public.auth_users
add column if not exists org_id bigint references public.orgs(org_id);

create table if not exists public.user_org_assignments (
  user_id bigint not null references public.auth_users(user_id) on delete cascade,
  org_id bigint not null references public.orgs(org_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create index if not exists auth_users_org_id_idx
on public.auth_users(org_id);

create index if not exists user_org_assignments_org_id_idx
on public.user_org_assignments(org_id);

grant select, insert, update, delete on public.user_org_assignments to authenticated;

insert into public.user_org_assignments (user_id, org_id)
select user_id, org_id
from public.auth_users
where org_id is not null
on conflict do nothing;

create or replace function public.app_current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select ar.role_key
  from public.auth_users au
  join public.auth_roles ar on ar.role_id = au.role_id
  where lower(au.email) = lower(auth.jwt() ->> 'email')
  limit 1;
$$;

create or replace function public.app_user_has_org(target_org_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.auth_users au
    where lower(au.email) = lower(auth.jwt() ->> 'email')
      and au.org_id = target_org_id
  )
  or exists (
    select 1
    from public.auth_users au
    join public.user_org_assignments uoa on uoa.user_id = au.user_id
    where lower(au.email) = lower(auth.jwt() ->> 'email')
      and uoa.org_id = target_org_id
  );
$$;

create or replace function public.app_can_access_person(target_person_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.app_current_user_role() = 'admin'
    or exists (
      select 1
      from public.people p
      where p.person_id = target_person_id
        and public.app_user_has_org(p.org_id)
    )
    or exists (
      select 1
      from public.person_org_assignments poa
      where poa.person_id = target_person_id
        and public.app_user_has_org(poa.org_id)
    );
$$;

create or replace function public.app_can_access_account_values(
  target_person_id bigint,
  target_system_id bigint
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.app_current_user_role() = 'admin'
    or (
      public.app_can_access_person(target_person_id)
      and exists (
        select 1
        from public.systems s
        where s.system_id = target_system_id
          and public.app_user_has_org(s.org_id)
      )
    );
$$;

revoke all on function public.app_current_user_role() from public;
revoke all on function public.app_user_has_org(bigint) from public;
revoke all on function public.app_can_access_person(bigint) from public;
revoke all on function public.app_can_access_account_values(bigint, bigint) from public;
grant execute on function public.app_current_user_role() to authenticated;
grant execute on function public.app_user_has_org(bigint) to authenticated;
grant execute on function public.app_can_access_person(bigint) to authenticated;
grant execute on function public.app_can_access_account_values(bigint, bigint) to authenticated;

alter table public.people enable row level security;
alter table public.accounts enable row level security;
alter table public.person_org_assignments enable row level security;
alter table public.user_org_assignments enable row level security;

drop policy if exists "Allow read access to all authenticated users" on public.people;
drop policy if exists "Allow read access to all authenticated users" on public.accounts;
drop policy if exists "Allow writes to admins and managers" on public.people;
drop policy if exists "Allow writes to admins and managers" on public.accounts;
drop policy if exists "Organization scoped people read" on public.people;
drop policy if exists "Organization scoped people write" on public.people;
drop policy if exists "Organization scoped accounts read" on public.accounts;
drop policy if exists "Organization scoped accounts write" on public.accounts;
drop policy if exists "Allow writes to admins and managers" on public.person_org_assignments;
drop policy if exists "Allow read access to all authenticated users" on public.person_org_assignments;
drop policy if exists "Organization scoped person assignments read" on public.person_org_assignments;
drop policy if exists "Organization scoped person assignments write" on public.person_org_assignments;
drop policy if exists "Organization scoped user assignments read" on public.user_org_assignments;
drop policy if exists "Admin user assignments write" on public.user_org_assignments;

create policy "Organization scoped people read"
on public.people
for select
to authenticated
using (public.app_can_access_person(person_id));

create policy "Organization scoped people write"
on public.people
for all
to authenticated
using (
  public.app_current_user_role() in ('admin', 'manager')
  and (
    public.app_current_user_role() = 'admin'
    or public.app_user_has_org(org_id)
  )
)
with check (
  public.app_current_user_role() in ('admin', 'manager')
  and (
    public.app_current_user_role() = 'admin'
    or public.app_user_has_org(org_id)
  )
);

create policy "Organization scoped accounts read"
on public.accounts
for select
to authenticated
using (public.app_can_access_account_values(person_id, system_id));

create policy "Organization scoped accounts write"
on public.accounts
for all
to authenticated
using (
  public.app_current_user_role() in ('admin', 'manager')
  and public.app_can_access_account_values(person_id, system_id)
)
with check (
  public.app_current_user_role() in ('admin', 'manager')
  and public.app_can_access_account_values(person_id, system_id)
);

create policy "Organization scoped person assignments read"
on public.person_org_assignments
for select
to authenticated
using (
  public.app_current_user_role() = 'admin'
  or public.app_user_has_org(org_id)
);

create policy "Organization scoped person assignments write"
on public.person_org_assignments
for all
to authenticated
using (
  public.app_current_user_role() in ('admin', 'manager')
  and (
    public.app_current_user_role() = 'admin'
    or public.app_user_has_org(org_id)
  )
)
with check (
  public.app_current_user_role() in ('admin', 'manager')
  and (
    public.app_current_user_role() = 'admin'
    or public.app_user_has_org(org_id)
  )
);

create policy "Organization scoped user assignments read"
on public.user_org_assignments
for select
to authenticated
using (
  public.app_current_user_role() = 'admin'
  or public.app_user_has_org(org_id)
);

create policy "Admin user assignments write"
on public.user_org_assignments
for all
to authenticated
using (public.app_current_user_role() = 'admin')
with check (public.app_current_user_role() = 'admin');
