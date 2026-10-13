import { MAX_QUEUE, createAnalytics, filterProps, flushAnalytics, isSafeString, readAnalyticsEnv, resetAnalyticsForTests, track } from '../../src/lib/observability/analytics';
import { hashUserId } from '../../src/lib/observability/hash';

const NOW = new Date('2026-10-13T10:00:00.000Z');

function setup(key = 'phc_test') {
  const fetch = jest.fn(async () => new Response('{}')) as unknown as jest.Mock & typeof globalThis.fetch;
  const a = createAnalytics({ key, host: 'https://eu.i.posthog.com' }, { fetch, now: () => NOW, schedule: () => undefined });
  return { a, fetch };
}

describe('hashUserId', () => {
  it('is the first 32 hex chars of sha256("user:" + id) — same in API / web', async () => {
    await expect(hashUserId('abc')).resolves.toBe('4dc0ddfa4a7ccd9e66b8a0ba00428c0e');
    await expect(hashUserId('abc')).resolves.toBe(await hashUserId('abc'));
    expect(await hashUserId('abd')).not.toBe(await hashUserId('abc'));
  });
});

describe('filterProps', () => {
  it('keeps allow-listed keys with safe values only', () => {
    expect(
      filterProps({
        client: 'mobile',
        method: 'otp',
        role: 'MUNSHI',
        kind: 'push',
        error_code: 'RATE_LIMITED',
        count: 3,
        duration_ms: 120.5,
        offline: true,
        app_version: '1.0.0',
      }),
    ).toEqual({ client: 'mobile', method: 'otp', role: 'MUNSHI', kind: 'push', error_code: 'RATE_LIMITED', count: 3, duration_ms: 120.5, offline: true, app_version: '1.0.0' });
  });

  it('drops money, personal data and unknown keys', () => {
    const out = filterProps({
      amountPaisa: 120000,
      total: 5,
      rate: 1500,
      balance: 9,
      name: 'Ahmed',
      tenantName: 'Khan Builders',
      phone: '+923001234567',
      email: 'a@b.pk',
      cnic: '35202-1234567-1',
      address: 'Lahore',
      accessToken: 'x',
      projectName: 'Tower',
      userId: 'u-1',
      foo: 'bar',
    });
    expect(out).toEqual({});
  });

  it('drops unsafe values on allowed keys', () => {
    expect(
      filterProps({
        source: 'ali@example.pk', // email
        status: '0300 1234567', // phone
        kind: 'eyJhbGciOiJIUzI1NiJ9.eyJ4IjoxfQ.sig', // JWT
        method: 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4', // long token
        error_code: 'Rs 5,000', // money
        role: '12500', // bare amount
        platform: 'x'.repeat(65), // too long
        client: 42, // numbers only for count / duration_ms
        count: Number.NaN,
        duration_ms: Infinity,
        offline: { nested: true },
      }),
    ).toEqual({});
    expect(isSafeString('android')).toBe(true);
  });
});

describe('track', () => {
  it('posts allow-listed props with the hashed distinct id and the company group', async () => {
    const { a, fetch } = setup();
    const id = await hashUserId('user-1');
    a.setIdentity(id, 'tenant-1');
    expect(a.track('sync_error', { kind: 'push', error_code: 'INTERNAL', count: 2, offline: false, amountPaisa: 5 } as Record<string, unknown>)).toBe(true);
    await a.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://eu.i.posthog.com/batch/');
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      api_key: 'phc_test',
      batch: [
        {
          event: 'sync_error',
          distinct_id: id,
          timestamp: NOW.toISOString(),
          properties: expect.objectContaining({ client: 'mobile', kind: 'push', error_code: 'INTERNAL', count: 2, offline: false, $groups: { company: 'tenant-1' } }),
        },
      ],
    });
    expect(body.batch[0].properties.amountPaisa).toBeUndefined();
    expect(body.batch[0].distinct_id).not.toContain('user-1');
    expect(a.pending()).toBe(0);
  });

  it('drops unknown events', () => {
    const { a, fetch } = setup();
    a.setIdentity('h', 't');
    expect(a.track('worker_created', { count: 1 })).toBe(false);
    expect(a.track('Login', {})).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends nothing without a key, or before identify / after logout', () => {
    const off = setup('');
    off.a.setIdentity('h', 't');
    expect(off.a.enabled).toBe(false);
    expect(off.a.track('login', { method: 'otp' })).toBe(false);
    expect(off.fetch).not.toHaveBeenCalled();

    const on = setup();
    expect(on.a.track('login', { method: 'otp' })).toBe(false);
    on.a.setIdentity('h', 't');
    on.a.clearIdentity();
    expect(on.a.track('login', { method: 'otp' })).toBe(false);
    expect(on.fetch).not.toHaveBeenCalled();
  });

  it('never throws offline: keeps the events queued and retries with backoff', async () => {
    let online = false;
    let t = NOW.getTime();
    const retries: Array<() => void> = [];
    const fetch = jest.fn(async () => {
      if (!online) throw new TypeError('Network request failed');
      return new Response('{}');
    });
    const a = createAnalytics({ key: 'k', host: 'https://h' }, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => new Date(t), schedule: (fn) => retries.push(fn) });
    a.setIdentity('h', null);
    expect(() => a.track('login', { method: 'otp' })).not.toThrow();
    await a.flush();
    expect(a.pending()).toBe(1);
    expect(retries).toHaveLength(1);

    // During the backoff new events are queued without hitting the network.
    expect(a.track('sync_error', { error_code: 'NETWORK', count: 1 })).toBe(true);
    await a.flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(a.pending()).toBe(2);

    // Back online: the scheduled retry sends both in one batch.
    online = true;
    t += 5_000;
    retries[0]!();
    await a.flush();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String((fetch.mock.calls[1] as unknown as [string, RequestInit])[1].body)).batch.map((e: { event: string }) => e.event)).toEqual(['login', 'sync_error']);
    expect(a.pending()).toBe(0);
  });

  it('keeps events on 429 / 5xx, drops a batch PostHog rejects with 4xx, caps the queue', async () => {
    let status = 503;
    const fetch = jest.fn(async () => new Response('{}', { status }));
    const a = createAnalytics({ key: 'k', host: 'https://h' }, { fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW, schedule: () => undefined });
    a.setIdentity('h', null);
    for (let i = 0; i < MAX_QUEUE + 20; i++) a.track('hazri_marked', { count: i });
    await a.flush(true);
    expect(a.pending()).toBe(MAX_QUEUE);
    status = 400;
    await a.flush(true);
    expect(a.pending()).toBe(0);
  });

  it('flush never rejects even when fetch itself throws synchronously', async () => {
    const fetch = jest.fn(() => {
      throw new Error('boom');
    }) as unknown as typeof globalThis.fetch;
    const a = createAnalytics({ key: 'k', host: 'https://h' }, { fetch, now: () => NOW, schedule: () => undefined });
    a.setIdentity('h', null);
    expect(a.track('login', {})).toBe(true);
    await expect(a.flush(true)).resolves.toBeUndefined();
    await expect(flushAnalytics()).resolves.toBeUndefined();
  });

  it('the default instance is a no-op when EXPO_PUBLIC_POSTHOG_KEY is empty', () => {
    const spy = jest.spyOn(globalThis, 'fetch' as never).mockImplementation((() => Promise.resolve(new Response('{}'))) as never);
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
    expect(readAnalyticsEnv()).toEqual({ key: '', host: 'https://us.i.posthog.com' });
    resetAnalyticsForTests();
    track('login', { method: 'otp' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
