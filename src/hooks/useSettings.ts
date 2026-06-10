import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ExportPreferences, Language, Theme } from '@/types/medication';

const SETTINGS_KEY = 'homemed-settings';

const defaultSettings: AppSettings = {
  language: 'system',
  theme: 'dark',
  exportPreferences: {
    includeNotes: true,
    includeEmergencySection: true,
  },
};

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
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

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    saveSettingsToStorage(settings);
    
    // Apply theme
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

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

  return {
    settings,
    setLanguage,
    setTheme,
    setExportPreferences,
    updateExportPreference,
  };
}
