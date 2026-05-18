-- Supabase Auth setup checklist for RLS mode.
--
-- 1. Run supabase-production-rls.sql.
-- 2. In Supabase Dashboard > Authentication > Users, create one Auth user for
--    every active row in public.auth_users using the same email.
-- 3. Set each Auth user's password manually, or invite/reset password from the
--    dashboard.
-- 4. The app resolves username -> email with public.resolve_login_email(), then
--    signs in through Supabase Auth.
-- 5. Roles are still read from public.auth_users + public.auth_roles by email,
--    so app_metadata.role is optional.
--
-- Useful check after creating Auth users:

select
  au.user_id,
  au.username,
  au.email,
  au.full_name,
  ar.role_key,
  au.is_active
from auth_users au
join auth_roles ar on ar.role_id = au.role_id
order by au.user_id;
