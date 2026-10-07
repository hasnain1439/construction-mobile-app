/**
 * fetch wrapper: bearer token, one refresh at a time (the server treats two parallel refreshes
 * as token theft and ends the login), typed errors. A NetworkError means "offline / server not
 * reachable" — callers keep the work on the phone and try later.
 */
import { API_BASE_URL } from './config';
import { ENDPOINTS } from './endpoints';
import { clearSession, getTokens, setTokens } from './session';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}
export class NetworkError extends Error {}

type Listener = () => void;
const signedOutListeners = new Set<Listener>();
/** Called when the refresh token no longer works (revoked phone, logged out elsewhere). */
export const onSignedOut = (l: Listener) => {
  signedOutListeners.add(l);
  return () => {
    signedOutListeners.delete(l);
  };
};

let refreshing: Promise<boolean> | null = null;

/** Rotates the tokens once; concurrent callers wait for the same refresh. */
export function refreshTokens(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const tokens = await getTokens();
      if (!tokens) return false;
      const res = await fetchImpl(`${API_BASE_URL}${ENDPOINTS.refresh}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ client: 'mobile', refreshToken: tokens.refreshToken }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          await clearSession();
          signedOutListeners.forEach((l) => l());
        }
        return false;
      }
      const body = (await res.json()) as { data: { accessToken: string; refreshToken: string } };
      await setTokens({ accessToken: body.data.accessToken, refreshToken: body.data.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
  auth?: boolean;
  fetchImpl?: typeof fetch;
  /** Default 20 s (60 s for uploads). */
  timeoutMs?: number;
}

export async function request<T>(path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const f = opts.fetchImpl ?? fetch;
  const qs = opts.query ? Object.entries(opts.query).filter(([, v]) => v !== undefined) : [];
  const url = `${API_BASE_URL}${path}${qs.length ? `?${qs.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : ''}`;
  const headers: Record<string, string> = { accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.auth !== false) {
    const t = await getTokens();
    if (t) headers['authorization'] = `Bearer ${t.accessToken}`;
  }
  let res: Response;
  // An unreachable server (wrong IP, firewall) can hang a fetch for minutes: give up and treat it as offline.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), opts.timeoutMs ?? (opts.form ? 60_000 : 20_000));
  try {
    res = await f(url, { method: opts.method ?? 'GET', headers, body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined), signal: abort.signal });
  } catch (err) {
    throw new NetworkError(abort.signal.aborted ? 'timeout' : err instanceof Error ? err.message : 'network');
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => null)) as { success: boolean; data?: T; error?: { code: string; message: string; details?: unknown } } | null;
  if (res.ok && json?.success) return json.data as T;
  const code = json?.error?.code ?? `HTTP_${res.status}`;
  if (res.status === 401 && code === 'TOKEN_EXPIRED' && opts.auth !== false && !retried) {
    if (await refreshTokens(f)) return request<T>(path, opts, true);
  }
  if (res.status === 401 && code === 'DEVICE_REVOKED') {
    await clearSession();
    signedOutListeners.forEach((l) => l());
  }
  if (res.status >= 500 || res.status === 429) throw new NetworkError(code);
  throw new ApiError(res.status, code, json?.error?.message ?? 'Request failed', json?.error?.details);
}
