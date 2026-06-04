import { createClient } from '@supabase/supabase-js';

// Safely access env vars — `import.meta.env` may be undefined in some runtimes
// (e.g. preview sandboxes). In a real Vite build, set VITE_SUPABASE_URL and
// VITE_SUPABASE_PUBLISHABLE_KEY or VITE_SUPABASE_ANON_KEY in your .env file.
const getEnv = (key: string): string | undefined => {
  try {
    // @ts-ignore — import.meta.env is Vite-specific and may not exist at runtime
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch {

    // ignore
  }return undefined;
};

const supabaseUrl =
getEnv('VITE_SUPABASE_URL') || 'https://placeholder-project.supabase.co';
const supabaseAnonKey =
getEnv('VITE_SUPABASE_PUBLISHABLE_KEY') ||
getEnv('VITE_SUPABASE_ANON_KEY') ||
'placeholder-anon-key';

if (supabaseUrl.includes('placeholder') || supabaseAnonKey.includes('placeholder')) {
  console.warn(
    '[VaultSys] Supabase env vars not set — running in prototype mode with mock fallback data.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/*
=============================================================================
CONCEPTUAL RLS POLICIES (Row Level Security)
=============================================================================

-- auth_roles
CREATE POLICY "Allow read access to all authenticated users" ON auth_roles FOR SELECT TO authenticated USING (true);

-- auth_users
CREATE POLICY "Allow read access to all authenticated users" ON auth_users FOR SELECT TO authenticated USING (true);
-- See scripts/admin-user-permissions.sql for the non-recursive admin policies
-- that allow INSERT and UPDATE operations.

-- orgs, people, systems, accounts
CREATE POLICY "Allow read access to all authenticated users" ON orgs FOR SELECT TO authenticated USING (true);
-- See scripts/manager-operational-permissions.sql. Managers can write to
-- people and accounts; organizations and systems are writable by admins only.
-- See scripts/user-organization-scope.sql to assign auth_users.org_id and
-- scope people/accounts access for non-admin users.

-- account_kv
CREATE POLICY "Allow read access to all authenticated users" ON account_kv FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow insert/update/delete to admins and managers" ON account_kv FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM auth_users au JOIN auth_roles ar ON au.role_id = ar.id WHERE au.id = auth.uid() AND ar.name IN ('admin', 'manager'))
);

-- audit_log
CREATE POLICY "Allow insert to all authenticated users" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow read to admins only" ON audit_log FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM auth_users au JOIN auth_roles ar ON au.role_id = ar.id WHERE au.id = auth.uid() AND ar.name = 'admin')
);

-- vault_secrets
CREATE POLICY "Allow read/write to admins only" ON vault_secrets FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM auth_users au JOIN auth_roles ar ON au.role_id = ar.id WHERE au.id = auth.uid() AND ar.name = 'admin')
);
=============================================================================
*/
