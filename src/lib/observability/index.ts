/**
 * Observability entry points used by the app: who is signed in (hashed), the `login` event and
 * client-side sync failures. Sentry and PostHog are each off when their env key is empty.
 * See README → Observability.
 */
import { ApiError, NetworkError } from '../../api/client';
import { clearAnalyticsIdentity, setAnalyticsIdentity, track } from './analytics';
import { hashUserId } from './hash';
import { captureException, clearSentryUser, setSentryUser } from './sentry';

export { flushAnalytics, track } from './analytics';
export { initSentry, wrapRoot } from './sentry';

interface Who {
  id: string;
  tenantId: string;
}

/** Sets the hashed distinct id + company group (PostHog) and the Sentry user. Never throws. */
export async function identifyUser(user: Who): Promise<void> {
  try {
    const id = await hashUserId(user.id);
    setAnalyticsIdentity(id, user.tenantId || null);
    setSentryUser(id, user.tenantId || null);
  } catch {
    // no identity → events are simply not sent
  }
}

/** Right after a successful sign-in. */
export async function trackLogin(user: Who & { role: string }, method: 'otp' | 'password'): Promise<void> {
  await identifyUser(user);
  track('login', { client: 'mobile', method, role: user.role });
}

export function clearUser(): void {
  try {
    clearAnalyticsIdentity();
    clearSentryUser();
  } catch {
    // ignore
  }
}

export type SyncFailureKind = 'upload' | 'push' | 'pull' | 'network';

const THROTTLE_MS = 10 * 60_000;
const lastSent = new Map<string, number>();

export function syncErrorCode(err: unknown): string {
  if (err instanceof NetworkError) return 'NETWORK';
  if (err instanceof ApiError) return err.code || `HTTP_${err.status}`;
  if (err instanceof Error && /^[A-Za-z]{1,40}$/.test(err.name)) return err.name;
  return 'UNKNOWN';
}

/**
 * A sync run failed. `sync_error` at most once per error_code per 10 minutes (an offline phone
 * retries often); non-network failures also go to Sentry. Returns whether anything was reported.
 */
export function reportSyncFailure(err: unknown, ctx: { stage: Exclude<SyncFailureKind, 'network'>; pending: number }, now = Date.now()): boolean {
  try {
    const offline = err instanceof NetworkError;
    const code = syncErrorCode(err);
    const last = lastSent.get(code);
    if (last !== undefined && now - last < THROTTLE_MS) return false;
    lastSent.set(code, now);
    const kind: SyncFailureKind = offline ? 'network' : ctx.stage;
    track('sync_error', { kind, error_code: code, count: ctx.pending, offline });
    if (!offline) captureException(err, { sync_kind: kind, error_code: code });
    return true;
  } catch {
    return false;
  }
}

/** Test helper. */
export function resetSyncThrottleForTests() {
  lastSent.clear();
}
