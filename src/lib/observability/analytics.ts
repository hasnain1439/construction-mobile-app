/**
 * Product analytics: a tiny fetch client for PostHog's `/batch/` API (no native SDK).
 * Off (no network at all) when EXPO_PUBLIC_POSTHOG_KEY is empty. Events go into an in-memory
 * queue (max 200, oldest dropped) and are sent in batches; when the phone is offline or PostHog
 * answers 429 / 5xx the batch stays queued and is retried with backoff (5 s → 5 min) or on the
 * next event. Nothing waits on it and nothing here ever throws.
 *
 * Shared contract with the API and web app — keep the three in step:
 *   - events: login, project_activated, hazri_marked, purchase_saved, invoice_issued, sync_error
 *   - distinct_id = hashUserId(userId); group `company` = tenantId (never the company name)
 *   - only the allow-listed property keys; numbers only for `count` / `duration_ms`; strings
 *     ≤ 64 chars that don't look like an email, phone, token or money amount.
 */
import { Platform } from 'react-native';
import { APP_VERSION } from '../../api/config';

export const ANALYTICS_EVENTS = ['login', 'project_activated', 'hazri_marked', 'purchase_saved', 'invoice_issued', 'sync_error'] as const;
export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

export const ANALYTICS_PROP_KEYS = ['client', 'platform', 'method', 'source', 'role', 'status', 'kind', 'count', 'error_code', 'app_version', 'offline', 'duration_ms'] as const;
export type AnalyticsPropKey = (typeof ANALYTICS_PROP_KEYS)[number];
export type AnalyticsProps = Partial<Record<AnalyticsPropKey, string | number | boolean>>;

const EVENT_SET = new Set<string>(ANALYTICS_EVENTS);
const KEY_SET = new Set<string>(ANALYTICS_PROP_KEYS);
const NUMERIC_KEYS = new Set<string>(['count', 'duration_ms']);
const FORBIDDEN_KEY = /amount|paisa|price|rate|total|balance|money|name|phone|email|cnic|address|token/i;

const LOOKS_EMAIL = /@|[A-Z0-9._%+-]+\s*(?:\[at\]|\(at\))/i;
const LOOKS_JWT = /eyJ[A-Za-z0-9_-]+\./;
const LOOKS_TOKEN = /[A-Za-z0-9_-]{24,}|bearer\s/i;
const LOOKS_MONEY = /(?:\brs\.?|\bpkr|₨|\$|€|£)\s*-?\d|^\s*-?[\d,]+(?:\.\d+)?\s*(?:\/-)?\s*$|\d+\s*(?:\/-|rs\b|pkr\b)/i;

/** True when a string value may be sent (≤ 64 chars, nothing personal, secret or money-like). */
export function isSafeString(v: string): boolean {
  if (v.length === 0 || v.length > 64) return false;
  if ((v.match(/\d/g)?.length ?? 0) >= 7) return false; // phone / CNIC / account number
  return !(LOOKS_EMAIL.test(v) || LOOKS_JWT.test(v) || LOOKS_TOKEN.test(v) || LOOKS_MONEY.test(v));
}

/** Keeps only allow-listed keys with safe values; everything else is dropped. */
export function filterProps(props: Record<string, unknown> | undefined): AnalyticsProps {
  const out: AnalyticsProps = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (!KEY_SET.has(key) || FORBIDDEN_KEY.test(key)) continue;
    const k = key as AnalyticsPropKey;
    if (typeof value === 'boolean') out[k] = value;
    else if (typeof value === 'number') {
      if (NUMERIC_KEYS.has(key) && Number.isFinite(value)) out[k] = value;
    } else if (typeof value === 'string' && isSafeString(value)) out[k] = value;
  }
  return out;
}

export const isAnalyticsEvent = (e: string): e is AnalyticsEvent => EVENT_SET.has(e);

export interface AnalyticsConfig {
  key: string;
  host: string;
}

export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com';

export function readAnalyticsEnv(): AnalyticsConfig {
  const key = (process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '').trim();
  const host = (process.env.EXPO_PUBLIC_POSTHOG_HOST ?? '').trim() || DEFAULT_POSTHOG_HOST;
  return { key, host: host.replace(/\/+$/, '') };
}

export interface AnalyticsDeps {
  fetch: typeof fetch;
  now: () => Date;
  /** Schedules a retry; defaults to setTimeout. */
  schedule: (fn: () => void, ms: number) => void;
}

export interface Analytics {
  readonly enabled: boolean;
  setIdentity: (distinctId: string, tenantId: string | null) => void;
  clearIdentity: () => void;
  /** Returns true when the event was queued; never throws. */
  track: (event: string, props?: Record<string, unknown>) => boolean;
  /** Sends what is queued (one request at a time; `force` ignores the backoff). Never rejects. */
  flush: (force?: boolean) => Promise<void>;
  /** Number of queued events (for tests). */
  pending: () => number;
}

interface QueuedEvent {
  event: AnalyticsEvent;
  distinct_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

export const MAX_QUEUE = 200;
const BATCH_SIZE = 50;
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000];

const defaultDeps = (): AnalyticsDeps => ({
  fetch: (...a) => fetch(...a),
  now: () => new Date(),
  schedule: (fn, ms) => {
    setTimeout(fn, ms);
  },
});

export function createAnalytics(cfg: AnalyticsConfig, deps: Partial<AnalyticsDeps> = {}): Analytics {
  const d: AnalyticsDeps = { ...defaultDeps(), ...deps };
  let distinctId: string | null = null;
  let tenantId: string | null = null;
  const enabled = cfg.key.length > 0;
  const queue: QueuedEvent[] = [];
  let inFlight: Promise<void> | null = null;
  let failures = 0;
  let retryAt = 0;
  let retryScheduled = false;

  function scheduleRetry() {
    const delay = BACKOFF_MS[Math.min(failures - 1, BACKOFF_MS.length - 1)]!;
    retryAt = d.now().getTime() + delay;
    if (retryScheduled) return;
    retryScheduled = true;
    try {
      d.schedule(() => {
        retryScheduled = false;
        void flush();
      }, delay);
    } catch {
      retryScheduled = false;
    }
  }

  async function sendBatch(): Promise<boolean> {
    const batch = queue.slice(0, BATCH_SIZE);
    let retry = false;
    try {
      const res = await d.fetch(`${cfg.host}/batch/`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ api_key: cfg.key, batch }) });
      // 429 / 5xx: PostHog is busy — keep the events. Other 4xx: the batch will never be accepted — drop it.
      retry = res.status === 429 || res.status >= 500;
    } catch {
      retry = true; // offline / DNS / timeout
    }
    if (retry) {
      failures += 1;
      scheduleRetry();
      return false;
    }
    // By identity: the queue may have been trimmed while the request was in flight.
    const sent = new Set(batch);
    for (let i = queue.length - 1; i >= 0; i--) if (sent.has(queue[i]!)) queue.splice(i, 1);
    failures = 0;
    retryAt = 0;
    return true;
  }

  function flush(force = false): Promise<void> {
    if (!enabled) return Promise.resolve();
    if (inFlight) return inFlight;
    if (queue.length === 0 || (!force && d.now().getTime() < retryAt)) return Promise.resolve();
    inFlight = (async () => {
      try {
        while (queue.length > 0 && (await sendBatch()));
      } catch {
        // never rejects
      } finally {
        inFlight = null;
      }
    })();
    return inFlight;
  }

  return {
    enabled,
    setIdentity(id, tenant) {
      distinctId = id;
      tenantId = tenant;
    },
    clearIdentity() {
      distinctId = null;
      tenantId = null;
    },
    track(event, props) {
      // No key, unknown event or nobody signed in (no anonymous ids): nothing is queued.
      if (!enabled || !isAnalyticsEvent(event) || !distinctId) return false;
      try {
        const properties: Record<string, unknown> = {
          ...filterProps({ client: 'mobile', platform: Platform.OS, app_version: APP_VERSION, ...props }),
          ...(tenantId ? { $groups: { company: tenantId } } : {}),
          $lib: 'munshi-mobile',
        };
        queue.push({ event, distinct_id: distinctId, properties, timestamp: d.now().toISOString() });
        if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
        void flush();
        return true;
      } catch {
        return false;
      }
    },
    flush,
    pending: () => queue.length,
  };
}

let instance: Analytics | null = null;
const analytics = () => (instance ??= createAnalytics(readAnalyticsEnv()));

/** The one way to send a product event (allow-listed event + props; no-op without a key). */
export function track(event: AnalyticsEvent, props?: AnalyticsProps): void {
  try {
    analytics().track(event, props);
  } catch {
    // Analytics never breaks the app.
  }
}

/** Retry queued events now (e.g. after a successful sync = we are online). No-op without a key. */
export function flushAnalytics(): Promise<void> {
  try {
    return analytics().flush(true);
  } catch {
    return Promise.resolve();
  }
}

export const setAnalyticsIdentity = (distinctId: string, tenantId: string | null) => analytics().setIdentity(distinctId, tenantId);
export const clearAnalyticsIdentity = () => analytics().clearIdentity();

/** Test helper. */
export function resetAnalyticsForTests(next: Analytics | null = null) {
  instance = next;
}
