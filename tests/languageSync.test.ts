/**
 * App language ↔ server preference: a choice in Mazeed is sent with PATCH /auth/me/preferences
 * (later when offline / signed out); the first sign-in takes the server's language when the
 * phone never had one chosen.
 */
import * as SecureStore from 'expo-secure-store';
import { passwordLogin } from '../src/api/auth';
import { ENDPOINTS } from '../src/api/endpoints';
import { clearSession, setTokens } from '../src/api/session';
import { LANGUAGE_KEY, LANGUAGE_SYNCED_KEY, languageAfterLogin, rememberLanguageChoice, retryLanguageSync, storedLanguage } from '../src/i18n/languageSync';

const store = (SecureStore as unknown as { __store: Map<string, string> }).__store;
type Call = { url: string; method: string; body: unknown };
let calls: Call[] = [];
let online = true;
const realFetch = global.fetch;

beforeEach(async () => {
  calls = [];
  online = true;
  store.delete(LANGUAGE_KEY);
  store.delete(LANGUAGE_SYNCED_KEY);
  await clearSession();
  global.fetch = (async (url: string, init?: RequestInit) => {
    if (!online) throw new Error('offline');
    calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const body = JSON.parse(String(init?.body ?? '{}')) as { language?: string };
    return new Response(JSON.stringify({ success: true, data: { language: body.language } }), { status: 200 });
  }) as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = realFetch;
});

const prefCalls = () => calls.filter((c) => c.url.endsWith(ENDPOINTS.mePreferences));

describe('language sync', () => {
  it('a choice while signed in is saved on the phone and sent to the server', async () => {
    await setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(await rememberLanguageChoice('ur')).toBe(true);
    expect(await storedLanguage()).toBe('ur');
    expect(prefCalls()).toEqual([expect.objectContaining({ method: 'PATCH', body: { language: 'ur' } })]);
    expect(store.get(LANGUAGE_SYNCED_KEY)).toBe('true');
  });

  it('offline: kept as "not synced" and sent on the next retry (app start / sign-in)', async () => {
    await setTokens({ accessToken: 'a', refreshToken: 'r' });
    online = false;
    expect(await rememberLanguageChoice('en')).toBe(false);
    expect(store.get(LANGUAGE_SYNCED_KEY)).toBe('false');
    online = true;
    expect(await retryLanguageSync()).toBe(true);
    expect(prefCalls().at(-1)!.body).toEqual({ language: 'en' });
    expect(await retryLanguageSync()).toBe(false); // nothing left to send
  });

  it('signed out (login screen): nothing is sent until there is a session', async () => {
    expect(await rememberLanguageChoice('roman')).toBe(false);
    expect(prefCalls()).toHaveLength(0);
  });

  it('first sign-in on a fresh phone takes the server language; a phone choice wins and is sent', async () => {
    expect(await languageAfterLogin('ur')).toBe('ur');
    expect(await storedLanguage()).toBe('ur');
    expect(prefCalls()).toHaveLength(0); // the server already has it

    // Chosen on the login screen (no session yet), then signed in: the phone's choice wins.
    store.delete(LANGUAGE_KEY);
    await rememberLanguageChoice('en');
    await setTokens({ accessToken: 'a', refreshToken: 'r' });
    expect(await languageAfterLogin('ur')).toBeNull();
    expect(prefCalls().at(-1)!.body).toEqual({ language: 'en' });
    expect(await languageAfterLogin('nonsense')).toBeNull();
  });

  it('the sign-in result carries the server language', async () => {
    global.fetch = (async () =>
      new Response(
        JSON.stringify({ success: true, data: { user: { id: 'u1', name: 'Asif', phone: '+923224567890', role: 'MUNSHI', language: 'ur' }, tenant: { id: 't1', name: 'Malik' }, accessToken: 'a', refreshToken: 'r' } }),
        { status: 200 },
      )) as unknown as typeof fetch;
    const signed = await passwordLogin('+923224567890', 'Asif#2026');
    expect(signed.language).toBe('ur');
  });
});
