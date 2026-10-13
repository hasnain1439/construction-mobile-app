/**
 * Removes personal data, secrets and money from crash reports before they leave the phone.
 * Pure (no Sentry import) so it is unit-tested directly; used as Sentry's `beforeSend`,
 * `beforeSendTransaction` and `beforeBreadcrumb`.
 *
 * Redacted in strings: emails, Pakistani / E.164 phone numbers, CNICs, JWTs, bearer / basic
 * credentials, long tokens, cookies, `Rs 1,200`-style amounts and secret URL query params
 * (token, code, sig, …). Dropped: request bodies, cookies, authorization / cookie headers,
 * everything on the user except the (already hashed) id.
 */

export const FILTERED = '[Filtered]';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// +92 300 1234567, 923001234567, 0300-1234567
const PK_PHONE = /(?:\+92|\b92|\b0)[\s-]?3\d{2}[\s-]?\d{7}\b/g;
// Any other international number: + then 8–15 digits (spaces / dashes allowed).
const E164 = /\+\d[\d\s-]{6,16}\d/g;
const CNIC = /\b\d{5}-?\d{7}-?\d\b/g;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g;
const AUTH_SCHEME = /\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]+/gi;
const COOKIE = /\b(set-cookie|cookie)\s*[:=]\s*[^\n]*/gi;
// Secret query params: ?token=…, &code=…, &sig=…
const SECRET_PARAM = /([?&#;](?:access_token|refresh_token|id_token|token|code|otp|sig|signature|password|api_key|apikey|key|auth|x-amz-signature|x-amz-credential|x-amz-security-token|phone|email)=)[^&#\s]*/gi;
// Long opaque tokens: 32+ chars of base64url, at least one digit and one letter (UUIDs are kept).
const LONG_TOKEN = /[A-Za-z0-9_-]{32,}/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MONEY = /(?:\bRs\.?|\bPKR|₨)\s?-?[\d,]+(?:\.\d+)?(?:\s?\/-)?/gi;

/** Object keys whose value is never kept (matched case-insensitively, anywhere in the key). */
const SECRET_KEY = /authorization|cookie|password|passwd|secret|token|otp|cnic|phone|mobile|email|amount|paisa|price|rate|total|balance|money|salary|wage|address|name$|body|data$/i;

export function scrubString(input: string): string {
  return input
    .replace(COOKIE, `$1=${FILTERED}`)
    .replace(AUTH_SCHEME, `$1 ${FILTERED}`)
    .replace(JWT, FILTERED)
    .replace(SECRET_PARAM, `$1${FILTERED}`)
    .replace(EMAIL, FILTERED)
    .replace(MONEY, FILTERED)
    .replace(PK_PHONE, FILTERED)
    .replace(CNIC, FILTERED)
    .replace(E164, FILTERED)
    .replace(LONG_TOKEN, (m) => (UUID.test(m) || !/\d/.test(m) || !/[A-Za-z]/.test(m) ? m : FILTERED));
}

/** Only scheme / host / path survive, plus scrubbed query params. */
export function scrubUrl(url: string): string {
  return scrubString(url);
}

/** Deep copy with secret keys filtered and every string scrubbed. Depth-limited. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 6) return FILTERED;
  if (Array.isArray(value)) return value.map((v) => scrubValue(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? FILTERED : scrubValue(v, depth + 1);
  }
  return out;
}

const SAFE_HEADERS = /^(accept|content-type|content-length|user-agent|x-request-id|x-client|x-pending-count)$/i;

function scrubHeaders(headers: unknown): Record<string, string> | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    if (SAFE_HEADERS.test(k) && typeof v === 'string') out[k] = scrubString(v);
  }
  return out;
}

// Minimal structural types (the scrubber must not import Sentry).
// No index signatures, so Sentry's own Event / Breadcrumb types are assignable to these.
interface ExceptionLike {
  type?: string;
  value?: string;
}
export interface BreadcrumbLike {
  category?: string;
  type?: string;
  message?: string;
  data?: { [k: string]: unknown };
}
export interface EventLike {
  message?: string;
  logentry?: { formatted?: string; message?: string; params?: unknown[] };
  exception?: { values?: ExceptionLike[] };
  request?: { url?: string; method?: string; query_string?: unknown; data?: unknown; cookies?: unknown; headers?: unknown; env?: unknown };
  user?: { id?: string | number; [k: string]: unknown };
  extra?: { [k: string]: unknown };
  tags?: { [k: string]: unknown };
  breadcrumbs?: BreadcrumbLike[];
  transaction?: string;
}

const BODY_KEYS = /body|payload|response|request_data|^data$|arguments/i;

export function scrubBreadcrumb<B extends BreadcrumbLike>(crumb: B): B | null {
  // Touch breadcrumbs carry on-screen labels (which may be a worker's name): keep only that a tap happened.
  if (crumb.category === 'touch' || crumb.category === 'ui.click') return { ...crumb, message: undefined, data: undefined };
  const out: B = { ...crumb };
  if (typeof out.message === 'string') out.message = scrubString(out.message);
  if (out.data && typeof out.data === 'object') {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(out.data)) {
      if (BODY_KEYS.test(k)) continue; // request / response bodies, console arguments
      if (k === 'url' || k === 'from' || k === 'to') data[k] = typeof v === 'string' ? scrubUrl(v) : v;
      else data[k] = SECRET_KEY.test(k) ? FILTERED : scrubValue(v);
    }
    out.data = data;
  }
  return out;
}

export function scrubEvent<E extends EventLike>(event: E): E {
  const e: E = { ...event };
  if (typeof e.message === 'string') e.message = scrubString(e.message);
  if (e.logentry) e.logentry = { ...e.logentry, formatted: e.logentry.formatted && scrubString(e.logentry.formatted), message: e.logentry.message && scrubString(e.logentry.message), params: undefined };
  if (e.exception?.values) {
    e.exception = { ...e.exception, values: e.exception.values.map((x) => ({ ...x, value: typeof x.value === 'string' ? scrubString(x.value) : x.value })) };
  }
  if (e.request) {
    const { data: _data, cookies: _cookies, ...rest } = e.request;
    e.request = {
      ...rest,
      url: typeof rest.url === 'string' ? scrubUrl(rest.url) : rest.url,
      query_string: typeof rest.query_string === 'string' ? scrubString(rest.query_string) : rest.query_string === undefined ? undefined : FILTERED,
      headers: scrubHeaders(rest.headers),
    };
  }
  // The hashed id only — never name / phone / email / IP.
  if (e.user) e.user = e.user.id === undefined ? {} : { id: e.user.id };
  if (e.extra) e.extra = scrubValue(e.extra) as Record<string, unknown>;
  if (e.tags) {
    const tags: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(e.tags)) tags[k] = typeof v === 'string' ? scrubString(v) : v;
    e.tags = tags;
  }
  if (typeof e.transaction === 'string') e.transaction = scrubString(e.transaction);
  if (e.breadcrumbs) e.breadcrumbs = e.breadcrumbs.map((b) => scrubBreadcrumb(b)).filter((b): b is BreadcrumbLike => b !== null);
  return e;
}
