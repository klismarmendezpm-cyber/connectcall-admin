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
  theme: 'system'
};

const SETTINGS_KEY = 'vault_settings';

export const getAppSettings = (): AppSettings => {
  try {
    const storedSettings = localStorage.getItem(SETTINGS_KEY);
    if (!storedSettings) return DEFAULT_APP_SETTINGS;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...JSON.parse(storedSettings)
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
  const prefersDark =
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldUseDark = theme === 'dark' || theme === 'system' && prefersDark;

  root.classList.toggle('theme-dark', shouldUseDark);
  root.classList.toggle('theme-light', !shouldUseDark);
};

export const initializeTheme = () => {
  applyThemeSetting(getAppSettings().theme);

  if (!window.matchMedia) return;
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleSystemThemeChange = () => {
    if (getAppSettings().theme === 'system') {
      applyThemeSetting('system');
    }
  };

  mediaQuery.addEventListener('change', handleSystemThemeChange);
};
