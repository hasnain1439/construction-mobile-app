/** Live updates on the phone (src/sync/live.ts): stream → delayed sync, own writes skipped, token refresh. */
import { AppState } from 'react-native';

const mockGetTokens = jest.fn(async (): Promise<unknown> => ({ accessToken: 'acc-1', refreshToken: 'ref-1' }));
const mockRefresh = jest.fn(async () => true);
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('../../src/api/session', () => ({ getTokens: () => mockGetTokens() }));
jest.mock('../../src/api/client', () => ({ refreshTokens: () => mockRefresh() }));
jest.mock('../../src/sync/triggers', () => ({ syncFromApp: jest.fn() }));

const { sseParser, startLiveSync } = require('../../src/sync/live') as typeof import('../../src/sync/live');
const { CLIENT_ID } = require('../../src/api/clientId') as typeof import('../../src/api/clientId');

const encoder = new TextEncoder();
/** A streaming response whose body yields `chunks`, then stays open until `signal` aborts. */
function streamResponse(chunks: string[], signal?: AbortSignal | null) {
  const queue = chunks.map((c) => encoder.encode(c));
  return {
    status: 200,
    ok: true,
    json: async () => null,
    body: {
      getReader: () => ({
        read: () =>
          queue.length
            ? Promise.resolve({ value: queue.shift(), done: false })
            : new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')))),
      }),
    },
  };
}
const ready = (lag: number) => `event: ready\ndata: {"syncLagMs":${lag}}\n\n`;
const change = (origin: string | null) => `event: change\ndata: ${JSON.stringify({ resource: 'sync/push', origin, at: '2026-10-26T07:40:00.000Z' })}\n\n`;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  mockRefresh.mockClear();
});
afterEach(() => jest.useRealTimers());

const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

describe('sseParser', () => {
  it('joins chunks, skips comments, handles CRLF', () => {
    const parse = sseParser();
    expect(parse('retry: 3000\n\nevent: ready\ndata: {"syncLag')).toEqual([]);
    expect(parse('Ms":30000}\r\n\r\n: ping\n\n')).toEqual([{ event: 'ready', data: '{"syncLagMs":30000}' }]);
  });
});

describe('startLiveSync', () => {
  it("syncs syncLagMs (+2 s) after someone else's change, one sync for a burst, skips own writes", async () => {
    const sync = jest.fn(async () => undefined);
    let now = 1_000_000;
    const fetchFn = jest.fn(async (_url: string, init?: { signal?: AbortSignal | null; headers?: Record<string, string> }) =>
      streamResponse([ready(30_000), change(CLIENT_ID), change('office-tab-1'), change('phone-2')], init?.signal),
    );
    const stop = startLiveSync({ fetchFn: fetchFn as never, sync, now: () => now });
    await flush();

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toMatch(/\/realtime\/stream$/);
    expect(init?.headers).toMatchObject({ authorization: 'Bearer acc-1', 'x-client-id': CLIENT_ID });

    now += 31_999;
    jest.advanceTimersByTime(31_999);
    await flush();
    expect(sync).not.toHaveBeenCalled();
    now += 1;
    jest.advanceTimersByTime(1);
    await flush();
    expect(sync).toHaveBeenCalledTimes(1);
    stop();
  });

  it('only its own write → no sync', async () => {
    const sync = jest.fn(async () => undefined);
    const fetchFn = jest.fn(async (_url: string, init?: { signal?: AbortSignal | null }) => streamResponse([ready(0), change(CLIENT_ID)], init?.signal));
    const stop = startLiveSync({ fetchFn: fetchFn as never, sync, now: () => 0 });
    await flush();
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(sync).not.toHaveBeenCalled();
    stop();
  });

  it('401 → refreshes the token and reconnects', async () => {
    let calls = 0;
    const fetchFn = jest.fn(async (_url: string, init?: { signal?: AbortSignal | null }) => {
      calls += 1;
      return calls === 1 ? { status: 401, ok: false, json: async () => ({ error: { code: 'TOKEN_EXPIRED' } }), body: null } : streamResponse([ready(0)], init?.signal);
    });
    const stop = startLiveSync({ fetchFn: fetchFn as never, sync: jest.fn(async () => undefined), now: () => 0 });
    await flush();
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    stop();
  });
});
