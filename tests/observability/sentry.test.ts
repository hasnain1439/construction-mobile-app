import * as Sentry from '@sentry/react-native';
import { NetworkError, ApiError } from '../../src/api/client';
import { reportSyncFailure, resetSyncThrottleForTests } from '../../src/lib/observability';
import { createAnalytics, resetAnalyticsForTests } from '../../src/lib/observability/analytics';
import { captureException, initSentry, readSentryEnv, resetSentryForTests, setSentryUser, wrapRoot } from '../../src/lib/observability/sentry';

const S = Sentry as unknown as Record<'init' | 'wrap' | 'captureException' | 'setUser' | 'setTag', jest.Mock>;
const cfg = { dsn: '', environment: 'test', release: undefined, tracesSampleRate: 0.1 };
const Root = () => null;

beforeEach(() => {
  jest.clearAllMocks();
  resetSentryForTests();
  resetSyncThrottleForTests();
  resetAnalyticsForTests();
});

describe('Sentry wrapper', () => {
  it('never calls Sentry.init without a DSN; every helper is a no-op', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    expect(readSentryEnv().dsn).toBe('');
    expect(readSentryEnv().tracesSampleRate).toBe(0.1);
    expect(initSentry()).toBe(false);
    expect(initSentry(cfg)).toBe(false);
    expect(wrapRoot(Root)).toBe(Root);
    captureException(new Error('x'));
    setSentryUser('hash', 't-1');
    expect(S.init).not.toHaveBeenCalled();
    expect(S.wrap).not.toHaveBeenCalled();
    expect(S.captureException).not.toHaveBeenCalled();
    expect(S.setUser).not.toHaveBeenCalled();
  });

  it('with a DSN: no PII, no replay / screenshots, scrubbing hooks installed', () => {
    expect(initSentry({ ...cfg, dsn: 'https://k@o1.ingest.sentry.io/1', tracesSampleRate: 0.25 })).toBe(true);
    expect(S.init).toHaveBeenCalledTimes(1);
    const opts = S.init.mock.calls[0]![0];
    expect(opts).toMatchObject({ sendDefaultPii: false, attachScreenshot: false, attachViewHierarchy: false, replaysSessionSampleRate: 0, replaysOnErrorSampleRate: 0, tracesSampleRate: 0.25, environment: 'test' });
    expect(opts.beforeSend({ user: { id: 'h', email: 'a@b.pk' }, message: 'a@b.pk' })).toEqual({ user: { id: 'h' }, message: '[Filtered]' });
    expect(typeof opts.beforeBreadcrumb).toBe('function');
    wrapRoot(Root);
    expect(S.wrap).toHaveBeenCalledWith(Root);
    setSentryUser('hash', 't-1');
    expect(S.setUser).toHaveBeenCalledWith({ id: 'hash' });
    expect(S.setTag).toHaveBeenCalledWith('tenantId', 't-1');
  });
});

describe('reportSyncFailure', () => {
  function withAnalytics() {
    const fetch = jest.fn(async () => new Response('{}'));
    const a = createAnalytics({ key: 'k', host: 'https://h' }, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => new Date(0), schedule: () => undefined });
    a.setIdentity('hash', 't-1');
    resetAnalyticsForTests(a);
    return { fetch, a };
  }
  // Every event PostHog received, across batches.
  const events = (fetch: jest.Mock) => fetch.mock.calls.flatMap((c) => JSON.parse(String((c[1] as RequestInit).body)).batch);

  it('tracks network failures without sending them to Sentry, throttled per error_code for 10 minutes', async () => {
    initSentry({ ...cfg, dsn: 'https://k@o1.ingest.sentry.io/1' });
    const { fetch, a } = withAnalytics();
    const t0 = 1_000_000;
    expect(reportSyncFailure(new NetworkError('offline'), { stage: 'push', pending: 4 }, t0)).toBe(true);
    expect(reportSyncFailure(new NetworkError('offline'), { stage: 'pull', pending: 5 }, t0 + 9 * 60_000)).toBe(false);
    expect(reportSyncFailure(new NetworkError('offline'), { stage: 'pull', pending: 5 }, t0 + 10 * 60_000)).toBe(true);
    expect(S.captureException).not.toHaveBeenCalled();
    await a.flush();
    await a.flush();
    expect(events(fetch)[0].properties).toMatchObject({ kind: 'network', error_code: 'NETWORK', count: 4, offline: true });
    expect(events(fetch)).toHaveLength(2);
  });

  it('sends other failures to Sentry and PostHog', async () => {
    initSentry({ ...cfg, dsn: 'https://k@o1.ingest.sentry.io/1' });
    const { fetch, a } = withAnalytics();
    const err = new ApiError(500, 'INTERNAL', 'boom');
    expect(reportSyncFailure(err, { stage: 'pull', pending: 0 })).toBe(true);
    expect(S.captureException).toHaveBeenCalledWith(err, { tags: { sync_kind: 'pull', error_code: 'INTERNAL' } });
    await a.flush();
    expect(events(fetch)[0]).toMatchObject({ event: 'sync_error', properties: { kind: 'pull', error_code: 'INTERNAL', count: 0, offline: false } });
  });
});
