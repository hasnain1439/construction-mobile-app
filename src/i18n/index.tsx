import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import { en, type TKey } from './en';
import { roman } from './roman';
import { ur } from './ur';

export type Language = 'roman' | 'en' | 'ur';
export type { TKey };

const LANGUAGE_KEY = 'app.language';
export const DEFAULT_LANGUAGE: Language = 'roman';

/** "{n} entries waiting" + { n: 12 } */
export function translate(language: Language, key: TKey, vars?: Record<string, string | number>): string {
  const text = (language === 'en' ? en[key] : language === 'ur' ? (ur[key] ?? roman[key]) : roman[key]) ?? en[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
}

/** A server error code → the message for the munshi (never the server's own text, which may hold details). */
export function errorText(language: Language, code: string | null | undefined): string {
  const key = `err.${code ?? ''}` as TKey;
  return key in en ? translate(language, key) : translate(language, 'err.generic');
}

interface I18n {
  language: Language;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => Promise<void>;
  rtl: boolean;
}

const Ctx = createContext<I18n>({ language: DEFAULT_LANGUAGE, t: (k, v) => translate(DEFAULT_LANGUAGE, k, v), setLanguage: async () => undefined, rtl: false });

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Language }) {
  const [language, setLang] = useState<Language>(initial ?? DEFAULT_LANGUAGE);
  useEffect(() => {
    if (initial) return;
    void SecureStore.getItemAsync(LANGUAGE_KEY).then((v) => {
      if (v === 'en' || v === 'ur' || v === 'roman') setLang(v);
    });
  }, [initial]);

  const setLanguage = useCallback(async (next: Language) => {
    await SecureStore.setItemAsync(LANGUAGE_KEY, next);
    setLang(next);
    const rtl = next === 'ur';
    // Urdu is right-to-left: the layout direction only changes after a reload.
    if (I18nManager.isRTL !== rtl) {
      I18nManager.allowRTL(rtl);
      I18nManager.forceRTL(rtl);
      try {
        await Updates.reloadAsync();
      } catch {
        DevSettings.reload();
      }
    }
  }, []);

  const value = useMemo<I18n>(() => ({ language, t: (k, v) => translate(language, k, v), setLanguage, rtl: language === 'ur' }), [language, setLanguage]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;
