import { NetworkError, request } from '../src/api/client';

/** A fetch that never answers (wrong IP / firewall) — it only ends when aborted. */
const hangingFetch = ((_url: string, init?: RequestInit) =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  })) as unknown as typeof fetch;

describe('api client', () => {
  it('gives up on an unreachable server instead of hanging (app start must not stick on the splash)', async () => {
    const started = Date.now();
    await expect(request('/auth/mobile-config', { auth: false, timeoutMs: 50, fetchImpl: hangingFetch })).rejects.toThrow(NetworkError);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('returns data on success and a typed error code on failure', async () => {
    const ok = (async () => new Response(JSON.stringify({ success: true, data: { v: 1 } }), { status: 200 })) as unknown as typeof fetch;
    await expect(request('/x', { auth: false, fetchImpl: ok })).resolves.toEqual({ v: 1 });
    const bad = (async () => new Response(JSON.stringify({ success: false, error: { code: 'OTP_INVALID', message: 'Wrong code' } }), { status: 400 })) as unknown as typeof fetch;
    await expect(request('/x', { auth: false, fetchImpl: bad })).rejects.toMatchObject({ code: 'OTP_INVALID', status: 400 });
  });

  it('server errors count as offline (retry later), not as a refusal', async () => {
    const down = (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch;
    await expect(request('/x', { auth: false, fetchImpl: down })).rejects.toBeInstanceOf(NetworkError);
  });
});
