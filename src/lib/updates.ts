/**
 * OTA updates (expo-updates). The native side checks on every cold start (checkAutomatically
 * ON_LOAD, fallbackToCacheTimeout 0: start with what is on the phone, download in the background,
 * use it on the next start). Munshis keep the app open for days, so the app also checks quietly
 * when it comes back to the foreground (at most every 6 hours) and downloads the update; it is
 * used on the next start — never a reload in the middle of an entry.
 *
 * The forced update for old native builds is separate: /auth/mobile-config → `update` screen.
 */
import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

export const UPDATE_CHECK_EVERY_MS = 6 * 60 * 60_000;

/** The parts of expo-updates used here (tests pass a fake). */
export interface UpdatesApi {
  isEnabled: boolean;
  checkForUpdateAsync(): Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync(): Promise<{ isNew: boolean }>;
}

export type UpdateCheckResult = 'disabled' | 'too-soon' | 'none' | 'downloaded' | 'error';

let lastCheckAt: number | null = null;
let inFlight: Promise<UpdateCheckResult> | null = null;

export const shouldCheckForUpdate = (last: number | null, now: number, everyMs = UPDATE_CHECK_EVERY_MS) => last === null || now - last >= everyMs;

/** One quiet check: no UI, no reload, errors swallowed (offline is normal on a site). */
export function quietUpdateCheck(api: UpdatesApi = Updates, now = Date.now(), dev = __DEV__): Promise<UpdateCheckResult> {
  if (dev || !api.isEnabled) return Promise.resolve('disabled');
  if (inFlight) return inFlight;
  if (!shouldCheckForUpdate(lastCheckAt, now)) return Promise.resolve('too-soon');
  lastCheckAt = now;
  inFlight = (async (): Promise<UpdateCheckResult> => {
    try {
      const check = await api.checkForUpdateAsync();
      if (!check.isAvailable) return 'none';
      const fetched = await api.fetchUpdateAsync();
      return fetched.isNew ? 'downloaded' : 'none';
    } catch {
      return 'error';
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Checks once on mount and each time the app returns to the foreground. */
export function useQuietUpdateCheck(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return undefined;
    void quietUpdateCheck();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void quietUpdateCheck();
    });
    return () => sub.remove();
  }, [enabled]);
}

/** "1.0.0" or "1.0.0 (preview · 0193ab12)" — which build and OTA update this phone runs, for support. */
export function versionLabel(appVersion: string, api: { isEnabled: boolean; channel: string | null; updateId: string | null; isEmbeddedLaunch: boolean } = Updates): string {
  if (!api.isEnabled || !api.channel) return appVersion;
  const update = !api.isEmbeddedLaunch && api.updateId ? ` · ${api.updateId.slice(0, 8)}` : '';
  return `${appVersion} (${api.channel}${update})`;
}

/** Test helper. */
export function resetUpdateCheckForTests() {
  lastCheckAt = null;
  inFlight = null;
}
