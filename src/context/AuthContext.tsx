import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { logAudit } from '../lib/auditLogger';
import { getAppSettings } from '../lib/appSettings';

export type Role = 'admin' | 'manager' | 'readonly';

export interface User {
  id: string | number;
  username: string;
  email: string;
  full_name: string;
  role_id: string | number;
  role_name: Role;
  is_active: boolean;
  last_login_at?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (
    usernameOrEmail: string,
    password: string,
    mfaCode?: string
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  logout: () => void;
  hasPermission: (requiredRoles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapProfileToUser = (profile: any): User => ({
  id: profile.id || profile.user_id,
  username: profile.username,
  email: profile.email,
  full_name: profile.full_name,
  role_id: profile.role_id,
  role_name: (profile.auth_roles?.role_key || profile.role_key || 'readonly') as Role,
  is_active: profile.is_active === true || profile.is_active === 1,
  last_login_at: profile.last_login_at
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadCurrentUser = async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      setUser(null);
      localStorage.removeItem('vault_user');
      setIsLoading(false);
      return null;
    }

    // With strict RLS policies, fetch the current profile from a secure
    // server-side RPC instead of querying auth_users directly from the client.
    const { data: currentProfile, error: currentProfileError } = await supabase
      .rpc('app_current_user_profile');
    let profileData = Array.isArray(currentProfile)
      ? currentProfile[0]
      : currentProfile;

    if (currentProfileError) {
      console.error('Could not load authenticated profile via RPC:', currentProfileError);
    }

    if (!profileData || typeof profileData !== 'object') {
      console.warn('No profile returned from app_current_user_profile, trying session email fallback', {
        currentProfile,
        sessionEmail: session.user.email
      });

      if (session.user?.email) {
        const {
          data: fallbackProfile,
          error: fallbackError
        } = await supabase.rpc('app_current_user_profile_by_email', {
          email: session.user.email
        });
        if (!fallbackError) {
          profileData = Array.isArray(fallbackProfile) ? fallbackProfile[0] : fallbackProfile;
          console.debug('Fallback profile loaded by session email:', profileData);
        } else {
          console.error('Fallback profile by email failed:', fallbackError);
        }
      }
    }

    if (!profileData || typeof profileData !== 'object') {
      console.error('No profile data returned from RPC:', currentProfile);
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('vault_user');
      setIsLoading(false);
      return null;
    }

    const nextUser = mapProfileToUser(profileData);
    if (!nextUser) {
      console.error('Mapped profile is invalid:', profileData);
      await supabase.auth.signOut();
      setUser(null);
      localStorage.removeItem('vault_user');
      setIsLoading(false);
      return null;
    }
    setUser(nextUser);
    localStorage.setItem('vault_user', JSON.stringify(nextUser));
    localStorage.setItem('vault_last_activity', Date.now().toString());
    setIsLoading(false);
    return nextUser;
  };

  useEffect(() => {
    loadCurrentUser();
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        localStorage.removeItem('vault_user');
        localStorage.removeItem('vault_last_activity');
        setIsLoading(false);
        return;
      }

      loadCurrentUser();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const updateActivity = () => {
      localStorage.setItem('vault_last_activity', Date.now().toString());
    };
    const checkSessionTimeout = () => {
      const settings = getAppSettings();
      const timeoutMs = Number(settings.sessionTimeout || 30) * 60 * 1000;
      const lastActivity = Number(
        localStorage.getItem('vault_last_activity') || Date.now()
      );
      if (Date.now() - lastActivity > timeoutMs) {
        logout();
      }
    };

    updateActivity();
    const events = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'];
    events.forEach((eventName) =>
      window.addEventListener(eventName, updateActivity)
    );
    const intervalId = window.setInterval(checkSessionTimeout, 30000);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, updateActivity)
      );
      window.clearInterval(intervalId);
    };
  }, [user]);

  const resolveLoginEmail = async (usernameOrEmail: string) => {
    if (usernameOrEmail.includes('@')) return usernameOrEmail.trim();

    const { data, error } = await supabase.rpc('resolve_login_email', {
      login_input: usernameOrEmail
    });

    if (error) {
      console.error('Could not resolve login email:', error);
      return '';
    }

    return data || '';
  };

  const login = async (
    usernameOrEmail: string,
    password: string,
    mfaCode?: string
  ) => {
    try {
      const email = await resolveLoginEmail(usernameOrEmail);
      console.debug('Resolved login email:', { usernameOrEmail, email });
      if (!email) {
        await logFailedAttempt(usernameOrEmail);
        return {
          success: false,
          error: 'No account found for that username or email'
        };
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      console.debug('Sign in result:', { email, signInData, signInError });

      if (signInError) {
        console.error('Supabase signIn error:', signInError);
        await logFailedAttempt(usernameOrEmail);
        return {
          success: false,
          error: signInError.message || 'Invalid credentials'
        };
      }

      const authenticatedUser = await loadCurrentUser();
      if (!authenticatedUser) {
        await logFailedAttempt(usernameOrEmail);
        return {
          success: false,
          error: 'Authenticated but could not load your profile; check RLS and auth_users mapping'
        };
      }

      const settings = getAppSettings();
      if (
        settings.requireMfa &&
        ['admin', 'manager'].includes(authenticatedUser.role_name) &&
        mfaCode !== settings.mfaCode
      ) {
        await supabase.auth.signOut();
        await logFailedAttempt(usernameOrEmail);
        return {
          success: false,
          error: 'Security code is required or invalid'
        };
      }

      await supabase
        .from('auth_users')
        .update({
          last_login_at: new Date().toISOString()
        })
        .eq('user_id', authenticatedUser.id);

      await supabase.from('auth_login_attempts').insert([
        {
          username: authenticatedUser.username,
          ip_address: 'client',
          success: 1,
          created_at: new Date().toISOString()
        }
      ]);

      await logAudit({
        actor: authenticatedUser.username,
        action: 'login',
        entity: 'auth_users',
        entity_id: authenticatedUser.id
      });

      await loadCurrentUser();
      return {
        success: true
      };
    } catch (err) {
      console.error('Login error:', err);
      return {
        success: false,
        error: 'An unexpected error occurred'
      };
    }
  };

  const logFailedAttempt = async (username: string) => {
    try {
      await supabase.from('auth_login_attempts').insert([
        {
          username,
          ip_address: 'client',
          success: 0,
          created_at: new Date().toISOString()
        }
      ]);
    } catch (e) {
      console.error('Failed to log attempt', e);
    }
  };

  const logout = () => {
    if (user) {
      logAudit({
        actor: user.username,
        action: 'view',
        entity: 'auth_users',
        metadata: {
          action: 'logout'
        }
      });
    }
    setUser(null);
    localStorage.removeItem('vault_user');
    localStorage.removeItem('vault_last_activity');
    supabase.auth.signOut();
  };

  const hasPermission = (requiredRoles: Role[]) => {
    if (!user) return false;
    return requiredRoles.includes(user.role_name);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        hasPermission
      }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
