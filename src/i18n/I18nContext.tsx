import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { translations } from './translations';
import type { TranslationKey } from './translations';
import type { Language } from '@/types/medication';

interface I18nContextType {
  language: Language;
  effectiveLanguage: 'en' | 'ar' | 'fr';
  isRTL: boolean;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'homemed-language';

function detectSystemLanguage(): 'en' | 'ar' | 'fr' {
  const lang = navigator.language || (navigator as any).userLanguage || 'en';
  const langCode = lang.toLowerCase().split('-')[0];
  
  if (langCode === 'ar') return 'ar';
  if (langCode === 'fr') return 'fr';
  return 'en';
}

function getStoredLanguage(): Language | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ['en', 'ar', 'fr', 'system'].includes(stored)) {
      return stored as Language;
    }
  } catch {
    // localStorage not available
  }
  return null;
}

function getEffectiveLanguage(lang: Language): 'en' | 'ar' | 'fr' {
  if (lang === 'system') {
    return detectSystemLanguage();
  }
  return lang;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    return getStoredLanguage() || 'system';
  });

  const effectiveLanguage = useMemo(() => getEffectiveLanguage(language), [language]);
  const isRTL = effectiveLanguage === 'ar';
  const dir = isRTL ? 'rtl' as const : 'ltr' as const;

  // Apply RTL to document
  useEffect(() => {
    document.documentElement.dir = dir;
    document.documentElement.lang = effectiveLanguage;
    
    // Add/remove RTL class for Tailwind
    if (isRTL) {
      document.documentElement.classList.add('rtl');
    } else {
      document.documentElement.classList.remove('rtl');
    }
  }, [isRTL, dir, effectiveLanguage]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // localStorage not available
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const msgs = translations[effectiveLanguage];
      return msgs[key] || key;
    },
    [effectiveLanguage]
  );

  const value = useMemo(
    () => ({
      language,
      effectiveLanguage,
      isRTL,
      setLanguage,
      t,
      dir,
    }),
    [language, effectiveLanguage, isRTL, setLanguage, t, dir]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
