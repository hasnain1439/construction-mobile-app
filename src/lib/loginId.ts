import { normalisePhone } from './phone';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email (lower-cased) or a Pakistani mobile number (E.164) — what the web sign-in accepts too. */
export function loginIdentifier(raw: string): string | null {
  const v = raw.trim();
  if (v.includes('@')) return EMAIL.test(v) ? v.toLowerCase() : null;
  return normalisePhone(v);
}
