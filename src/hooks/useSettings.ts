import { useState, useEffect, useCallback } from 'react';
import type { AppSettings, ExportPreferences, Language, Theme } from '@/types/medication';

const SETTINGS_KEY = 'homemed-settings';

const defaultSettings: AppSettings = {
  language: 'system',
  theme: 'system',
  exportPreferences: { includeNotes: true, includeEmergencySection: true },
  animationsEnabled: true,
  dateFormat: 'DMY',
  datePickerType: 'full',
  notifications: {
    expiringSoonEnabled: true,
    expiredEnabled: true,
    daysBeforeExpiry: 30,
  },
  autoDeleteExpired: false,
  smartMergeEnabled: true,
};

function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...defaultSettings,
        ...parsed,
        exportPreferences: { ...defaultSettings.exportPreferences, ...(parsed.exportPreferences ?? {}) },
        notifications: { ...defaultSettings.notifications, ...(parsed.notifications ?? {}) },
      };
    }
  } catch {}
  return { ...defaultSettings };
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = theme === 'dark' || (theme === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', dark);
}

function applyAnimations(enabled: boolean) {
  document.documentElement.classList.toggle('no-animations', !enabled);
}

// ── Module-level shared store (pub-sub) ───────────────────────────────────
// All useSettings() instances share the same state and update each other
// instantly — no restart needed.
let _s: AppSettings = loadSettings();
const _subs = new Set<(s: AppSettings) => void>();

function dispatch(next: AppSettings) {
  _s = next;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch {}
  applyTheme(next.theme);
  applyAnimations(next.animationsEnabled);
  _subs.forEach(fn => fn({ ...next }));
}
// ─────────────────────────────────────────────────────────────────────────

/** Synchronous snapshot of the current settings — safe to call outside React components. */
export function getSettings(): AppSettings {
  return { ..._s };
}

export function useSettings() {
  const [settings, setLocal] = useState<AppSettings>(() => ({ ..._s }));

  useEffect(() => {
    _subs.add(setLocal);
    // Apply side-effects on mount
    applyTheme(_s.theme);
    applyAnimations(_s.animationsEnabled);
    return () => { _subs.delete(setLocal); };
  }, []);

  // System theme listener
  useEffect(() => {
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [settings.theme]);

  const setLanguage = useCallback(
    (language: Language) => dispatch({ ..._s, language }), []);

  const setTheme = useCallback(
    (theme: Theme) => dispatch({ ..._s, theme }), []);

  const setExportPreferences = useCallback(
    (exportPreferences: ExportPreferences) => dispatch({ ..._s, exportPreferences }), []);

  const updateExportPreference = useCallback(
    (key: keyof ExportPreferences, value: boolean) =>
      dispatch({ ..._s, exportPreferences: { ..._s.exportPreferences, [key]: value } }), []);

  const setAnimationsEnabled = useCallback(
    (animationsEnabled: boolean) => dispatch({ ..._s, animationsEnabled }), []);

  const setDateFormat = useCallback(
    (dateFormat: 'DMY' | 'MDY' | 'YMD') => dispatch({ ..._s, dateFormat }), []);

  const setDatePickerType = useCallback(
    (datePickerType: 'full' | 'month-year') => dispatch({ ..._s, datePickerType }), []);

  const setNotificationPreference = useCallback(
    (key: keyof AppSettings['notifications'], value: boolean | number) =>
      dispatch({ ..._s, notifications: { ..._s.notifications, [key]: value } }), []);

  const setAutoDeleteExpired = useCallback(
    (autoDeleteExpired: boolean) => dispatch({ ..._s, autoDeleteExpired }), []);

  const setSmartMergeEnabled = useCallback(
    (smartMergeEnabled: boolean) => dispatch({ ..._s, smartMergeEnabled }), []);

  return {
    settings,
    setLanguage,
    setTheme,
    setExportPreferences,
    updateExportPreference,
    setAnimationsEnabled,
    setDateFormat,
    setDatePickerType,
    setNotificationPreference,
    setAutoDeleteExpired,
    setSmartMergeEnabled,
  };
}
