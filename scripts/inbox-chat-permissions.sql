-- Run this migration in the Supabase SQL editor.
-- Allows admins and managers to reply, close/reopen, create and delete chats.

alter table public.inbox_messages enable row level security;

grant select, insert, update, delete on public.inbox_messages to authenticated;


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

revoke all on function public.app_current_user_role() from public;
grant execute on function public.app_current_user_role() to authenticated;

drop policy if exists "Inbox read for authenticated users" on public.inbox_messages;
drop policy if exists "Inbox create for authenticated users" on public.inbox_messages;
drop policy if exists "Inbox update for admins and managers" on public.inbox_messages;
drop policy if exists "Inbox delete for admins and managers" on public.inbox_messages;

create policy "Inbox read for authenticated users"
on public.inbox_messages
for select
to authenticated
using (true);

create policy "Inbox create for authenticated users"
on public.inbox_messages
for insert
to authenticated
with check (true);

create policy "Inbox update for admins and managers"
on public.inbox_messages
for update
to authenticated
using (public.app_current_user_role() in ('admin', 'manager'))
with check (public.app_current_user_role() in ('admin', 'manager'));

create policy "Inbox delete for admins and managers"
on public.inbox_messages
for delete
to authenticated
using (public.app_current_user_role() in ('admin', 'manager'));
