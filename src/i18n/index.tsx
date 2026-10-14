import * as SecureStore from 'expo-secure-store';
import * as Updates from 'expo-updates';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DevSettings, I18nManager } from 'react-native';
import { dateTime, longDate, shortDate, timeAgo, weekDayNarrow, weekDayShort } from '../lib/dates';
import { en, type TKey } from './en';
import { roman } from './roman';
import { ur } from './ur';
import { languageAfterLogin, LANGUAGE_KEY, rememberLanguageChoice } from './languageSync';

export type Language = 'roman' | 'en' | 'ur';
export type { TKey };

export const DEFAULT_LANGUAGE: Language = 'roman';

/** Each language named in its own script (the picker shows all three, whatever the current language). */
export const LANGUAGE_NAMES: { id: Language; label: string }[] = [
  { id: 'roman', label: 'Roman Urdu' },
  { id: 'ur', label: 'اردو' },
  { id: 'en', label: 'English' },
];

/** Every dictionary has every key (TypeScript + tests/i18n.test.ts); English is the source. */
export const DICTIONARIES: Record<Language, Record<TKey, string>> = { en, roman, ur };

/**
 * Inside Urdu (RTL) text every inserted value is wrapped in a Unicode first-strong isolate
 * (U+2068 … U+2069), so a Latin name, "Rs 1,500", "−Rs 50" or "3/12" keeps its own direction
 * instead of jumping to the other end of the sentence.
 */
const isolate = (language: Language, value: string) => (language === 'ur' ? `⁨${value}⁩` : value);

/** "{n} entries waiting" + { n: 12 } */
export function translate(language: Language, key: TKey, vars?: Record<string, string | number>): string {
  const text = DICTIONARIES[language][key] || en[key] || key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined ? `{${k}}` : isolate(language, String(vars[k])))) : text;
}

/** A key built from server data (`cat.${category}`): its text when the dictionary has it, else null. */
export function translateMaybe(language: Language, key: string): string | null {
  return key in en ? translate(language, key as TKey) : null;
}

/** Material / sub-contract unit ("bag", "SQFT") in the language; a unit the app doesn't know is shown as the office wrote it. */
export function unitLabel(language: Language, unit: string | null | undefined): string {
  if (!unit) return '';
  return translateMaybe(language, `unit.${unit.trim().toLowerCase()}`) ?? unit;
}

/** The person's role: a built-in permission role or account type in the language, else the company's own role name. */
export function roleLabel(language: Language, role: string | null | undefined, permissionRole?: { key?: string | null; name?: string | null } | null): string {
  const builtIn = permissionRole?.key ? translateMaybe(language, `role.${permissionRole.key}`) : null;
  return builtIn ?? permissionRole?.name ?? (role ? (translateMaybe(language, `role.${role}`) ?? role) : '');
}

/** What a sync entry was ("Peshgi", "Hazri"…), from its outbox type. */
export const outboxTitle = (language: Language, type: string): string | null => translateMaybe(language, `outbox.${type}`);

/** A server error code → the message for the munshi (never the server's own text, which may hold details). */
export function errorText(language: Language, code: string | null | undefined): string {
  return translateMaybe(language, `err.${code ?? ''}`) ?? translate(language, 'err.generic');
}

/**
 * Why the server refused a sync entry (the outbox keeps `{ code, message, details }` as JSON):
 * PERMISSION_DENIED → "Aap ko is ki ijazat nahi", like a REST 403 with the same code.
 */
export function rejectedText(language: Language, lastError: string | null | undefined): string {
  let code: string | undefined;
  try {
    code = lastError ? (JSON.parse(lastError) as { code?: string } | null)?.code : undefined;
  } catch {
    code = undefined;
  }
  return errorText(language, code);
}

/** Dates and units in one language (month and weekday names from the dictionaries, Western digits). */
export interface Formatters {
  shortDate: (day: string | null | undefined) => string;
  longDate: (day: string | null | undefined) => string;
  dateTime: (iso: string | null | undefined) => string;
  weekDayShort: (day: string) => string;
  weekDayNarrow: (day: string) => string;
  timeAgo: (when: number | Date) => string;
  unit: (unit: string | null | undefined) => string;
}

export const formattersFor = (language: Language): Formatters => ({
  shortDate: (d) => shortDate(d, language),
  longDate: (d) => longDate(d, language),
  dateTime: (d) => dateTime(d, language),
  weekDayShort: (d) => weekDayShort(d, language),
  weekDayNarrow: (d) => weekDayNarrow(d, language),
  timeAgo: (w) => timeAgo(w, language),
  unit: (u) => unitLabel(language, u),
});

interface I18n {
  language: Language;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  setLanguage: (language: Language) => Promise<void>;
  /** After a sign-in: take the server's language when nobody chose one on this phone. */
  adoptServerLanguage: (serverLanguage: unknown) => Promise<void>;
  rtl: boolean;
  f: Formatters;
}

const Ctx = createContext<I18n>({ language: DEFAULT_LANGUAGE, t: (k, v) => translate(DEFAULT_LANGUAGE, k, v), setLanguage: async () => undefined, adoptServerLanguage: async () => undefined, rtl: false, f: formattersFor(DEFAULT_LANGUAGE) });

export function I18nProvider({ children, initial }: { children: ReactNode; initial?: Language }) {
  const [language, setLang] = useState<Language>(initial ?? DEFAULT_LANGUAGE);
  useEffect(() => {
    if (initial) return;
    void SecureStore.getItemAsync(LANGUAGE_KEY).then((v) => {
      if (v === 'en' || v === 'ur' || v === 'roman') setLang(v);
    });
  }, [initial]);

  /** Shows `next` (Urdu flips the layout to right-to-left, which needs a reload). */
  const apply = useCallback(async (next: Language) => {
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

  // The person's choice: kept on the phone and sent to the server (SMS / notifications / PDFs in
  // the same language) before an Urdu ↔ LTR reload; offline it is sent later (languageSync.ts).
  const setLanguage = useCallback(
    async (next: Language) => {
      await rememberLanguageChoice(next);
      await apply(next);
    },
    [apply],
  );

  const adoptServerLanguage = useCallback(
    async (serverLanguage: unknown) => {
      const next = await languageAfterLogin(serverLanguage);
      if (next) await apply(next);
    },
    [apply],
  );

  const value = useMemo<I18n>(
    () => ({ language, t: (k, v) => translate(language, k, v), setLanguage, adoptServerLanguage, rtl: language === 'ur', f: formattersFor(language) }),
    [language, setLanguage, adoptServerLanguage],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
export const useT = () => useContext(Ctx).t;
/** Date and unit formatters in the current language. */
export const useFormat = () => useContext(Ctx).f;
