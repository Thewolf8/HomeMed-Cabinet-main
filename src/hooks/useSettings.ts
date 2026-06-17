import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ExportPreferences, Language, Theme } from '@/types/medication';

const SETTINGS_KEY = 'homemed-settings';

const defaultSettings: AppSettings = {
  language: 'system',
  theme: 'system',
  exportPreferences: {
    includeNotes: true,
    includeEmergencySection: true,
  },
  animationsEnabled: true,
};

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Migrate old 'dark' default to 'system' if user never explicitly chose
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // localStorage not available
  }
  return { ...defaultSettings };
}

function saveSettingsToStorage(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // localStorage not available
  }
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const shouldBeDark = theme === 'dark' || (theme === 'system' && prefersDark);
  if (shouldBeDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    saveSettingsToStorage(settings);
    applyTheme(settings.theme);
  }, [settings]);

  // Listen to system theme changes in real-time when theme is 'system'
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

  const setLanguage = useCallback((language: Language) => {
    setSettings((prev) => ({ ...prev, language }));
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  }, []);

  const setExportPreferences = useCallback((prefs: ExportPreferences) => {
    setSettings((prev) => ({ ...prev, exportPreferences: prefs }));
  }, []);

  const updateExportPreference = useCallback((key: keyof ExportPreferences, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      exportPreferences: { ...prev.exportPreferences, [key]: value },
    }));
  }, []);

  const setAnimationsEnabled = useCallback((value: boolean) => {
    setSettings((prev) => ({ ...prev, animationsEnabled: value }));
  }, []);

  return {
    settings,
    setLanguage,
    setTheme,
    setExportPreferences,
    updateExportPreference,
    setAnimationsEnabled,
  };
}
