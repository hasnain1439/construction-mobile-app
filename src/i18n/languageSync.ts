/**
 * The app language ↔ the server's `User.language` (PATCH /auth/me/preferences), so SMS,
 * notifications and PDFs reach the munshi in the language the app shows.
 *
 *  - A choice in Mazeed (or on the login screen) is stored locally and marked "not synced"; it
 *    is sent when signed in, else right after the next sign-in / app start (`retryLanguageSync`).
 *  - First sign-in on a phone where nobody chose a language: the app takes the server's
 *    `language` from the login result (`languageAfterLogin`).
 * Never throws: offline or a server error just leaves it for the next try.
 */
import * as SecureStore from 'expo-secure-store';
import { request } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { getTokens } from '../api/session';

export type AppLanguage = 'roman' | 'en' | 'ur';

export const LANGUAGE_KEY = 'app.language';
/** 'false' while the local choice has not reached the server. */
export const LANGUAGE_SYNCED_KEY = 'app.language.synced';

export const isAppLanguage = (v: unknown): v is AppLanguage => v === 'roman' || v === 'en' || v === 'ur';

/** The language chosen on this phone (null = never chosen). */
export async function storedLanguage(): Promise<AppLanguage | null> {
  const v = await SecureStore.getItemAsync(LANGUAGE_KEY);
  return isAppLanguage(v) ? v : null;
}

/** Sends the language to the server when signed in. True when the server has it. */
export async function pushLanguage(language: AppLanguage): Promise<boolean> {
  if (!(await getTokens())) return false; // not signed in: sent after sign-in
  try {
    await request<{ language: AppLanguage }>(ENDPOINTS.mePreferences, { method: 'PATCH', body: { language }, timeoutMs: 8000 });
    await SecureStore.setItemAsync(LANGUAGE_SYNCED_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

/** The person picked a language: keep it, then tell the server (best effort). */
export async function rememberLanguageChoice(language: AppLanguage): Promise<boolean> {
  await SecureStore.setItemAsync(LANGUAGE_KEY, language);
  await SecureStore.setItemAsync(LANGUAGE_SYNCED_KEY, 'false');
  return pushLanguage(language);
}

/** A choice that has not reached the server yet is sent again (app start, after sign-in). */
export async function retryLanguageSync(): Promise<boolean> {
  const local = await storedLanguage();
  if (!local || (await SecureStore.getItemAsync(LANGUAGE_SYNCED_KEY)) !== 'false') return false;
  return pushLanguage(local);
}

/**
 * After a sign-in: the language the app should switch to, or null to keep the current one.
 * Never chosen on this phone → the server's language (kept as the phone's choice, already synced).
 * Chosen here but not sent yet → sent now; the phone's choice wins.
 */
export async function languageAfterLogin(serverLanguage: unknown): Promise<AppLanguage | null> {
  const local = await storedLanguage();
  if (!local) {
    if (!isAppLanguage(serverLanguage)) return null;
    await SecureStore.setItemAsync(LANGUAGE_KEY, serverLanguage);
    await SecureStore.setItemAsync(LANGUAGE_SYNCED_KEY, 'true');
    return serverLanguage;
  }
  await retryLanguageSync();
  return null;
}
