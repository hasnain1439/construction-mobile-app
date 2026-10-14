/**
 * App start and sign-in state:
 *   booting → update (app too old) | signedOut | firstSync (signed in, nothing pulled yet) | ready
 * Logout first tries to send the outbox; if entries remain, the caller must confirm ("force").
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMe, getMobileConfig, serverLogout, versionLess, type MobileConfig, type SignedIn } from '../api/auth';
import { onSignedOut } from '../api/client';
import { APP_VERSION } from '../api/config';
import { clearSession, getDeviceId, getUser, setUser, type SessionUser } from '../api/session';
import { openDb } from '../db/client';
import { wipeAll } from '../db/kv';
import { notifyChange } from '../db/live';
import type { Db } from '../db/types';
import { httpSyncApi } from '../sync/api';
import { syncNow } from '../sync/engine';
import { pendingCount } from '../sync/outbox';
import { getSyncState, pullAll } from '../sync/pull';
import { stopBackgroundSync } from '../sync/triggers';
import { saveAccess } from '../db/access';
import { clearUser, identifyUser, trackLogin } from '../lib/observability';
import { useI18n } from '../i18n';
import { retryLanguageSync } from '../i18n/languageSync';

export type SessionStatus = 'booting' | 'update' | 'signedOut' | 'firstSync' | 'ready';

interface Session {
  status: SessionStatus;
  user: SessionUser | null;
  config: MobileConfig | null;
  bootError: string | null;
  /** After login / OTP: the result's access block is stored for offline use. */
  signedIn: (user: SignedIn | SessionUser, method?: 'otp' | 'password') => void;
  runFirstSync: () => Promise<void>;
  /** { pending } when entries could not be sent and `force` was not given. */
  logout: (force?: boolean) => Promise<{ done: boolean; pending: number }>;
}

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { adoptServerLanguage } = useI18n();
  const [status, setStatus] = useState<SessionStatus>('booting');
  const [user, setUserState] = useState<SessionUser | null>(null);
  const [config, setConfig] = useState<MobileConfig | null>(null);
  const [db, setDb] = useState<Db | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const d = await openDb();
        setDb(d);
        // The version check needs the network; offline the app keeps working.
        const cfg = await getMobileConfig().catch(() => null);
        setConfig(cfg);
        if (cfg && versionLess(APP_VERSION, cfg.minimumAppVersion)) return setStatus('update');
        const u = await getUser();
        setUserState(u);
        if (!u) return setStatus('signedOut');
        void identifyUser(u); // hashed id + company only (Sentry / PostHog, when configured)
        setStatus(getSyncState(d).lastPullAt ? 'ready' : 'firstSync');
        // Fresh permissions when online (offline: the last stored block is used).
        void getMe()
          .then(async (me) => {
            // A language picked while offline reaches the server now.
            void retryLanguageSync();
            if (saveAccess(d, me)) notifyChange();
            if (me.user.role !== u.role) {
              const next = { ...u, role: me.user.role };
              await setUser(next);
              setUserState(next);
            }
          })
          .catch(() => undefined);
      } catch (err) {
        setBootError(err instanceof Error ? err.message : String(err));
      }
    })();
  }, []);

  const wipe = useCallback(async () => {
    if (db) wipeAll(db);
    notifyChange();
    await clearSession();
    await stopBackgroundSync().catch(() => undefined);
    clearUser();
    setUserState(null);
    setStatus('signedOut');
  }, [db]);

  // Revoked phone / refresh token no longer valid.
  useEffect(() => onSignedOut(() => void wipe()), [wipe]);

  const signedIn = useCallback(
    (signed: SignedIn | SessionUser, method?: 'otp' | 'password') => {
      const { access, language, ...u } = { access: undefined, language: undefined, ...signed };
      // Another person's data never stays on the phone.
      if (db && user && user.id !== u.id) wipeAll(db);
      if (db && access) saveAccess(db, access);
      notifyChange();
      setUserState(u);
      setStatus('firstSync');
      // Hashed id + company group, then `login` (no-ops when PostHog / Sentry are not configured).
      void trackLogin(u, method ?? 'otp');
      // First sign-in on this phone: the app takes the person's language from the server; a choice
      // made on this phone wins and is sent to the server instead.
      void adoptServerLanguage(language);
    },
    [db, user, adoptServerLanguage],
  );

  const runFirstSync = useCallback(async () => {
    if (!db) return;
    await pullAll(db, httpSyncApi);
    notifyChange();
    setStatus('ready');
  }, [db]);

  const logout = useCallback(
    async (force = false) => {
      if (!db) return { done: false, pending: 0 };
      await syncNow(db, httpSyncApi, { pushOnly: true, deviceId: (await getDeviceId()) ?? undefined });
      const pending = pendingCount(db);
      if (pending > 0 && !force) return { done: false, pending };
      await serverLogout().catch(() => undefined);
      await wipe();
      return { done: true, pending };
    },
    [db, wipe],
  );

  const value = useMemo<Session>(() => ({ status, user, config, bootError, signedIn, runFirstSync, logout }), [status, user, config, bootError, signedIn, runFirstSync, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): Session {
  const s = useContext(Ctx);
  if (!s) throw new Error('useSession outside SessionProvider');
  return s;
}

/** The signed-in person (screens inside the tabs only). */
export function useUser(): SessionUser {
  const u = useSession().user;
  if (!u) throw new Error('Not signed in');
  return u;
}
