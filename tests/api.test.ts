import { passwordLogin } from '../src/api/auth';
import { NetworkError, request } from '../src/api/client';
import { getTokens, getUser } from '../src/api/session';

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

describe('password sign-in (when the SMS code does not arrive)', () => {
  it('posts phone + password as a mobile client and keeps the session', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const realFetch = global.fetch;
    global.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({
          success: true,
          data: { user: { id: 'u1', name: 'Asif', phone: '+923224567890', role: 'MUNSHI' }, tenant: { id: 't1', name: 'Malik' }, accessToken: 'a', refreshToken: 'r' },
        }),
        { status: 200 },
      );
    }) as typeof fetch;
    try {
      const user = await passwordLogin('+923224567890', 'Asif#2026');
      expect(user).toMatchObject({ id: 'u1', role: 'MUNSHI', tenantName: 'Malik' });
      expect(calls[0]!.url).toMatch(/\/auth\/login$/);
      expect(calls[0]!.body).toMatchObject({ login: '+923224567890', password: 'Asif#2026', client: 'mobile', device: expect.objectContaining({ deviceId: expect.any(String) }) });
      expect(await getTokens()).toEqual({ accessToken: 'a', refreshToken: 'r' });
      expect((await getUser())?.name).toBe('Asif');
    } finally {
      global.fetch = realFetch;
    }
  });

  it('a wrong password is a typed error the screen can explain', async () => {
    const realFetch = global.fetch;
    global.fetch = (async () => new Response(JSON.stringify({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'x' } }), { status: 401 })) as unknown as typeof fetch;
    try {
      await expect(passwordLogin('+923224567890', 'nope')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    } finally {
      global.fetch = realFetch;
    }
  });
});
