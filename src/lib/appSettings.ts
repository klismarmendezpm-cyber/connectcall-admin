export interface AppSettings {
  sessionTimeout: string;
  requireMfa: boolean;
  mfaCode: string;
  emailNotifications: boolean;
  failedLoginAlerts: boolean;
  auditRetention: string;
  theme: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  sessionTimeout: '30',
  requireMfa: false,
  mfaCode: '123456',
  emailNotifications: true,
  failedLoginAlerts: true,
  auditRetention: '90',
  theme: 'light'
};

const SETTINGS_KEY = 'vault_settings';

export const getAppSettings = (): AppSettings => {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (!storedSettings) return DEFAULT_APP_SETTINGS;
    const parsedSettings = JSON.parse(storedSettings);
    const normalizedTheme = parsedSettings.theme === 'dark' ? 'dark' : 'light';
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsedSettings,
      theme: normalizedTheme
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

export const saveAppSettings = (settings: AppSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  applyThemeSetting(settings.theme);
  window.dispatchEvent(new CustomEvent('vault_settings_changed', {
    detail: settings
  }));
};

export const applyThemeSetting = (theme: string) => {
  const root = document.documentElement;
  const shouldUseDark = theme === 'dark';

  root.classList.toggle('theme-dark', shouldUseDark);
  root.classList.toggle('theme-light', !shouldUseDark);
};

export const initializeTheme = () => {
  applyThemeSetting(getAppSettings().theme);
};
