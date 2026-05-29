import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Lock,
  Bell,
  Database,
  Save } from
'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  DEFAULT_APP_SETTINGS,
  applyThemeSetting,
  getAppSettings,
  saveAppSettings
} from '../lib/appSettings';
import { logAudit } from '../lib/auditLogger';
export const Settings = () => {
  const { user, hasPermission } = useAuth();
  const isAdmin = hasPermission(['admin']);
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);
  const [secrets, setSecrets] = useState<any[]>([]);
  const [settings, setSettings] = useState(DEFAULT_APP_SETTINGS);
  useEffect(() => {
    setSettings(getAppSettings());
  }, []);
  useEffect(() => {
    if (isAdmin && activeTab === 'vault') {
      fetchSecrets();
    }
  }, [isAdmin, activeTab]);
  const fetchSecrets = async () => {
    try {
      const { data, error } = await supabase.
      from('vault_secrets').
      select(
        `
          id:secret_id,
          account_id,
          key_id,
          rotated_at,
          expires_at,
          created_at,
          accounts (
            username,
            display_label,
            people (full_name),
            systems (system_name)
          )
        `
      ).
      order('created_at', {
        ascending: false
      });
      if (error) throw error;
      if (data && data.length > 0) {
        setSecrets(data);
      } else {
        setSecrets([
        {
          id: 1,
          key_id: 'SUPABASE_SERVICE_ROLE',
          account_id: null,
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          key_id: 'SMTP_PASSWORD',
          account_id: null,
          created_at: new Date().toISOString()
        }]
        );
      }
    } catch (error) {
      console.error('Error fetching vault secrets:', error);
      setSecrets([
      {
        id: 1,
        key_id: 'SUPABASE_SERVICE_ROLE',
        account_id: null,
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        key_id: 'SMTP_PASSWORD',
        account_id: null,
        created_at: new Date().toISOString()
      }]
      );
    }
  };
  const enforceAuditRetention = async () => {
    const retentionDays = Number(settings.auditRetention);
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { error } = await supabase.
    from('audit_log').
    delete().
    lt('created_at', cutoffDate.toISOString());

    if (error) {
      console.warn('Audit retention could not be enforced:', error);
      toast.info('Audit retention saved. Add audit_log.created_at to enable automatic cleanup.');
    }
  };
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      saveAppSettings(settings);
      await enforceAuditRetention();
      await logAudit({
        actor: user?.username || 'unknown',
        action: 'update',
        entity: 'settings',
        entity_id: 0,
        metadata: {
          sessionTimeout: settings.sessionTimeout,
          requireMfa: settings.requireMfa,
          emailNotifications: settings.emailNotifications,
          failedLoginAlerts: settings.failedLoginAlerts,
          auditRetention: settings.auditRetention,
          theme: settings.theme
        }
      });
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 flex items-center">
          <SettingsIcon className="w-6 h-6 mr-2 text-brand-primary" />
          System Settings
        </h2>
        <p className="text-slate-500 mt-1">
          Configure application behavior and security policies
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Settings Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="card overflow-hidden">
            <nav className="flex flex-col">
              <button
                onClick={() => setActiveTab('general')}
                className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-brand-primary/5 text-brand-primary border-l-4 border-brand-primary' : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'}`}>
                
                <SettingsIcon className="w-4 h-4 mr-3" />
                General
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-brand-primary/5 text-brand-primary border-l-4 border-brand-primary' : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'}`}>
                
                <Lock className="w-4 h-4 mr-3" />
                Security
              </button>
              <button
                onClick={() => setActiveTab('notifications')}
                className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'notifications' ? 'bg-brand-primary/5 text-brand-primary border-l-4 border-brand-primary' : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'}`}>
                
                <Bell className="w-4 h-4 mr-3" />
                Notifications
              </button>
              {isAdmin &&
              <button
                onClick={() => setActiveTab('vault')}
                className={`flex items-center px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'vault' ? 'bg-brand-primary/5 text-brand-primary border-l-4 border-brand-primary' : 'text-slate-600 hover:bg-slate-50 border-l-4 border-transparent'}`}>
                
                  <Database className="w-4 h-4 mr-3" />
                  Vault Secrets
                </button>
              }
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1">
          <div className="card p-6">
            {activeTab === 'general' &&
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-3">
                  General Settings
                </h3>

                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      System Name
                    </label>
                    <input
                    type="text"
                    className="input-field mt-1"
                    defaultValue="VaultSys Enterprise"
                    disabled />
                  
                    <p className="text-xs text-slate-500 mt-1">
                      Controlled by environment variables.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Theme Preference
                    </label>
                    <select
                    className="input-field mt-1"
                    value={settings.theme}
                    disabled={!isAdmin}
                    onChange={(e) => {
                    const nextSettings = {
                      ...settings,
                      theme: e.target.value
                    };
                    setSettings(nextSettings);
                    applyThemeSetting(nextSettings.theme);
                    }}>
                    
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
              </div>
            }

            {activeTab === 'security' &&
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-3">
                  Security Policies
                </h3>

                <div className="space-y-6 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Session Timeout (minutes)
                    </label>
                    <select
                    className="input-field mt-1"
                    value={settings.sessionTimeout}
                    disabled={!isAdmin}
                    onChange={(e) =>
                    setSettings({
                      ...settings,
                      sessionTimeout: e.target.value
                    })
                    }>
                    
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                      <option value="60">1 hour</option>
                      <option value="120">2 hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700">
                      Audit Log Retention (days)
                    </label>
                    <select
                    className="input-field mt-1"
                    value={settings.auditRetention}
                    disabled={!isAdmin}
                    onChange={(e) =>
                    setSettings({
                      ...settings,
                      auditRetention: e.target.value
                    })
                    }>
                    
                      <option value="30">30 days</option>
                      <option value="90">90 days</option>
                      <option value="180">180 days</option>
                      <option value="365">1 year</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                    id="requireMfa"
                    type="checkbox"
                    checked={settings.requireMfa}
                    disabled={!isAdmin}
                    onChange={(e) =>
                    setSettings({
                      ...settings,
                      requireMfa: e.target.checked
                    })
                    }
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded" />
                  
                    <label
                    htmlFor="requireMfa"
                    className="ml-2 block text-sm text-slate-700">
                    
                      Require MFA for all admin users
                    </label>
                  </div>

                  {settings.requireMfa &&
                  <div>
                      <label className="block text-sm font-medium text-slate-700">
                        Admin Security Code
                      </label>
                      <input
                    type="text"
                    inputMode="numeric"
                    value={settings.mfaCode}
                    disabled={!isAdmin}
                    onChange={(e) =>
                    setSettings({
                      ...settings,
                      mfaCode: e.target.value
                    })
                    }
                    className="input-field mt-1 font-mono"
                    placeholder="123456" />
                      <p className="text-xs text-slate-500 mt-1">
                        Admin and manager users must enter this code during
                        sign in when MFA is enabled.
                      </p>
                    </div>
                  }
                </div>
              </div>
            }

            {activeTab === 'notifications' &&
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-3">
                  Notification Preferences
                </h3>

                <div className="space-y-4 max-w-md">
                  <div className="flex items-center">
                    <input
                    id="emailNotif"
                    type="checkbox"
                    checked={settings.emailNotifications}
                    disabled={!isAdmin}
                    onChange={(e) =>
                    setSettings({
                      ...settings,
                      emailNotifications: e.target.checked
                    })
                    }
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded" />
                  
                    <label
                    htmlFor="emailNotif"
                    className="ml-2 block text-sm text-slate-700">
                    
                      Email notifications for new inbox messages
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                    id="alertNotif"
                    type="checkbox"
                    checked={settings.failedLoginAlerts}
                    disabled={!isAdmin}
                    onChange={(e) =>
                    setSettings({
                      ...settings,
                      failedLoginAlerts: e.target.checked
                    })
                    }
                    className="h-4 w-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded" />
                  
                    <label
                    htmlFor="alertNotif"
                    className="ml-2 block text-sm text-slate-700">
                    
                      Alert admins on failed login attempts
                    </label>
                  </div>
                </div>
              </div>
            }

            {activeTab === 'vault' && isAdmin &&
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-slate-900 border-b border-slate-200 pb-3">
                  Internal Vault Secrets
                </h3>
                <p className="text-sm text-slate-500 mb-4">
                  These are system-level secrets used by Edge Functions and
                  integrations.
                </p>

                <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-2 font-medium text-slate-700">
                          Key ID
                        </th>
                        <th className="px-4 py-2 font-medium text-slate-700">
                          Account
                        </th>
                        <th className="px-4 py-2 font-medium text-slate-700">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {secrets.map((secret) =>
                    <tr key={secret.id}>
                          <td className="px-4 py-3 font-mono text-slate-900">
                            {secret.key_id}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {secret.accounts?.display_label ||
                        secret.accounts?.username ||
                        secret.accounts?.people?.full_name ||
                        `Account #${secret.account_id || '-'}`}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-500">
                            {new Date(secret.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                    )}
                    </tbody>
                  </table>
                </div>
              </div>
            }

            {activeTab !== 'vault' && isAdmin &&
            <div className="mt-8 pt-5 border-t border-slate-200 flex justify-end">
                <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="btn-primary flex items-center">
                
                  {isSaving ?
                'Saving...' :

                <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                }
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </div>);

};
