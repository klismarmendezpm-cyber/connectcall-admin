import React, { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { verifyPassword } from '../lib/edgeFunctions';
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
  mfaCode?: string)
  => Promise<{
    success: boolean;
    error?: string;
  }>;
  logout: () => void;
  hasPermission: (requiredRoles: Role[]) => boolean;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
// Mock initial user for prototype purposes if Supabase isn't connected
const MOCK_USER: User = {
  id: 1,
  username: 'admin',
  email: 'admin@company.com',
  full_name: 'System Administrator',
  role_id: 1,
  role_name: 'admin',
  is_active: true,
  last_login_at: new Date().toISOString()
};
export const AuthProvider = ({ children }: {children: ReactNode;}) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    // Check local storage for session
    const storedUser = localStorage.getItem('vault_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user');
      }
    }
    setIsLoading(false);
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
  const login = async (
  usernameOrEmail: string,
  password: string,
  mfaCode?: string) => {
    try {
      // 1. Fetch user from Supabase
      const { data: users, error } = await supabase.
      from('auth_users').
      select(
        `
          user_id,
          username,
          email,
          full_name,
          pass_hash,
          role_id,
          is_active,
          last_login_at
        `
      ).
      or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`).
      eq('is_active', 1).
      limit(1);
      let authenticatedUser: User | null = null;
      if (error || !users || users.length === 0) {
        if (error) {
          console.error('Supabase auth_users lookup failed:', error);
        }
        // Fallback to mock for prototype if DB is empty/failing
        if (usernameOrEmail === 'admin' && password === 'password123') {
          authenticatedUser = MOCK_USER;
        } else {
          await logFailedAttempt(usernameOrEmail);
          return {
            success: false,
            error: 'Invalid credentials or inactive account'
          };
        }
      } else {
        const dbUser = users[0];
        const { data: roleData, error: roleError } = await supabase.
        from('auth_roles').
        select('role_key').
        eq('role_id', dbUser.role_id).
        maybeSingle();

        if (roleError) {
          console.error('Supabase auth_roles lookup failed:', roleError);
        }

        // 2. Verify password using Edge Function
        const { valid } = await verifyPassword(password, dbUser.pass_hash);
        if (!valid) {
          await logFailedAttempt(usernameOrEmail);
          return {
            success: false,
            error: 'Invalid credentials'
          };
        }
        const roleName = roleData?.role_key as Role || 'readonly';
        const settings = getAppSettings();
        if (
        settings.requireMfa &&
        ['admin', 'manager'].includes(roleName) &&
        mfaCode !== settings.mfaCode)
        {
          await logFailedAttempt(usernameOrEmail);
          return {
            success: false,
            error: 'Security code is required or invalid'
          };
        }
        authenticatedUser = {
          id: dbUser.user_id,
          username: dbUser.username,
          email: dbUser.email,
          full_name: dbUser.full_name,
          role_id: dbUser.role_id,
          role_name: roleName,
          is_active: dbUser.is_active === true || dbUser.is_active === 1,
          last_login_at: dbUser.last_login_at
        };
      }
      if (authenticatedUser) {
        // 3. Update last login
        if (authenticatedUser.id !== MOCK_USER.id) {
          await supabase.
          from('auth_users').
          update({
            last_login_at: new Date().toISOString()
            // last_login_ip would be set by a secure backend/edge function in reality
          }).
          eq('user_id', authenticatedUser.id);
        }
        // 4. Log successful attempt
        await supabase.from('auth_login_attempts').insert([
        {
          username: authenticatedUser.username,
          ip_address: 'client',
          success: 1,
          created_at: new Date().toISOString()
        }]
        );
        await logAudit({
          actor: authenticatedUser.username,
          action: 'login',
          entity: 'auth_users',
          entity_id: authenticatedUser.id
        });
        // 5. Set session
        setUser(authenticatedUser);
        localStorage.setItem('vault_user', JSON.stringify(authenticatedUser));
        localStorage.setItem('vault_last_activity', Date.now().toString());
        return {
          success: true
        };
      }
      return {
        success: false,
        error: 'Authentication failed'
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
      }]
      );
      await logAudit({
        actor: username || 'unknown',
        action: 'login_failed',
        entity: 'auth_users'
      });
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
    </AuthContext.Provider>);

};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
