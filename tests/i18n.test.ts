/**
 * Every screen must be fully in Roman Urdu and Urdu: English (src/i18n/en.ts) is the source of
 * every key, and roman / ur must have exactly the same keys, no empty texts, the same {placeholders},
 * and Urdu must really be Urdu (no English left in it, apart from a few allowed brand words / units).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { en } from '../src/i18n/en';
import { roman } from '../src/i18n/roman';
import { ur } from '../src/i18n/ur';
import { DICTIONARIES, errorText, outboxTitle, roleLabel, translate, unitLabel, type Language } from '../src/i18n';
import { dateTime, longDate, shortDate, timeAgo, weekDayNarrow, weekDayShort } from '../src/lib/dates';
import { ENDPOINTS } from '../src/api/endpoints';

const ROOT = join(__dirname, '..');
const EN_KEYS = Object.keys(en).sort();

/** Latin words that may stay in Urdu text (brands, units and abbreviations people read as they are). */
const URDU_ALLOWED_LATIN = ['Keystone', 'Rs', 'kg', 'OTP', 'PDF', 'SMS', 'OT', 'PKR'];

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const latinLeft = (s: string) => URDU_ALLOWED_LATIN.reduce((rest, word) => rest.replace(new RegExp(`\\b${word}\\b`, 'g'), ''), s.replace(/\{\w+\}/g, '')).match(/[A-Za-z]+/g) ?? [];

describe('dictionaries', () => {
  it.each([
    ['roman', roman],
    ['ur', ur],
  ] as const)('%s has every English key and no extra keys', (_name, dict) => {
    const keys = Object.keys(dict).sort();
    const missing = EN_KEYS.filter((k) => !(k in dict));
    const extra = keys.filter((k) => !(k in en));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  it.each(Object.entries(DICTIONARIES))('%s has no empty texts', (_name, dict) => {
    const empty = Object.entries(dict)
      .filter(([, v]) => typeof v !== 'string' || !v.trim())
      .map(([k]) => k);
    expect(empty).toEqual([]);
  });

  it.each([
    ['roman', roman],
    ['ur', ur],
  ] as const)('%s keeps the same {placeholders} as English', (_name, dict) => {
    const wrong = EN_KEYS.filter((k) => placeholders(dict[k as keyof typeof en]).join() !== placeholders(en[k as keyof typeof en]).join());
    expect(wrong).toEqual([]);
  });

  it('Urdu is not English: no text copied from English, no Latin words except the allowed ones', () => {
    const copied = EN_KEYS.filter((k) => {
      const e = en[k as keyof typeof en];
      return ur[k as keyof typeof en] === e && latinLeft(e).length > 0;
    });
    const latin = EN_KEYS.filter((k) => latinLeft(ur[k as keyof typeof en]).length > 0).map((k) => `${k}: ${latinLeft(ur[k as keyof typeof en]).join(' ')}`);
    expect({ copied, latin }).toEqual({ copied: [], latin: [] });
  });

  it('translate never falls back: every language returns its own text', () => {
    for (const key of EN_KEYS) {
      expect(translate('ur', key as keyof typeof en)).toBe(ur[key as keyof typeof en]);
      expect(translate('roman', key as keyof typeof en)).toBe(roman[key as keyof typeof en]);
    }
  });
});

/** Server error codes the app can receive: from the API description of every endpoint it calls, plus codes named in the app's own code. */
function codesTheAppCanReceive(): string[] {
  const schema = readFileSync(join(ROOT, 'src/api/schema.ts'), 'utf8');
  const lines = schema.split('\n');
  const codes = new Set<string>();
  const add = (text: string) => {
    for (const m of text.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[A-Z]{4,}\b/g)) codes.add(m[0]);
  };
  for (const path of Object.values(ENDPOINTS)) {
    const start = lines.findIndex((l) => l.startsWith(`    "/api/v1${path}": {`));
    if (start < 0) continue; // an endpoint the generated types don't describe (yet)
    const end = lines.findIndex((l, i) => i > start && /^ {4}"\//.test(l));
    for (const line of lines.slice(start, end < 0 ? undefined : end)) {
      // "@description OTP_RESEND_WAIT | OTP_LIMIT_REACHED | RATE_LIMITED" on an error response
      const listed = /@description ([A-Z][A-Z_]+(?: \| [A-Z][A-Z_]+)*)\s*\*\/\s*$/.exec(line);
      if (listed) add(listed[1]!);
      // "`503 SMS_UNAVAILABLE`" in an endpoint description
      for (const m of line.matchAll(/`?\b[45]\d\d ([A-Z][A-Z_]{3,})/g)) codes.add(m[1]!);
      // sync push: "**REJECTED** (permanent: code, message, details — e.g. PERMISSION_DENIED (…), WEEK_LOCKED, …) · **RETRY**"
      const rejected = /\*\*REJECTED\*\* \(permanent:.*?e\.g\. (.*?)\) · \*\*RETRY/.exec(line);
      if (rejected) add(rejected[1]!.replace(/\([^)]*\)/g, ''));
    }
  }
  for (const dir of ['src', 'app', 'components']) {
    for (const file of sourceFiles(join(ROOT, dir))) {
      if (file.endsWith('schema.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/code\s*===\s*'([A-Z][A-Z_]+)'/g)) codes.add(m[1]!);
      for (const m of text.matchAll(/'([A-Z][A-Z_]*_FAILED)'/g)) codes.add(m[1]!);
    }
  }
  // Not error codes: words from the descriptions.
  for (const word of ['APPLIED', 'DUPLICATE', 'REJECTED', 'RETRY', 'LOGIN', 'POST', 'JSON', 'HTTP']) codes.delete(word);
  return [...codes].sort();
}

function sourceFiles(dir: string): string[] {
  const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs');
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? sourceFiles(full) : /\.tsx?$/.test(name) ? [full] : [];
  });
}

describe('server error codes', () => {
  const codes = codesTheAppCanReceive();

  it('finds the error codes of the endpoints the app calls', () => {
    expect(codes).toEqual(expect.arrayContaining(['SMS_UNAVAILABLE', 'PERMISSION_DENIED', 'WEEK_LOCKED', 'DEVICE_REVOKED', 'MULTIPLE_COMPANIES']));
  });

  it('every code has its own message in English, Roman Urdu and Urdu', () => {
    const missing = codes.filter((c) => !(`err.${c}` in en));
    expect(missing).toEqual([]);
    for (const lang of ['en', 'roman', 'ur'] as Language[]) {
      for (const c of codes) expect(errorText(lang, c)).not.toBe(translate(lang, 'err.generic'));
    }
  });

  it('an unknown code falls back to the generic message', () => {
    expect(errorText('ur', 'SOMETHING_NEW')).toBe(ur['err.generic']);
    expect(errorText('roman', undefined)).toBe(roman['err.generic']);
  });
});

describe('formatting in the user language', () => {
  it('dates use the language’s month and day names with Western digits', () => {
    expect(shortDate('2026-10-06', 'en')).toBe('6 Oct');
    expect(longDate('2026-10-06', 'ur')).toBe('6 اکتوبر 2026');
    expect(weekDayShort('2026-10-05', 'roman')).toBe('Peer');
    expect(weekDayNarrow('2026-10-05', 'en')).toBe('Mo');
    expect(dateTime('2026-10-06T09:15:00.000Z', 'en')).toBe('6 Oct, 2:15 PM');
    expect(dateTime('2026-10-06T03:05:00.000Z', 'ur')).toBe('6 اکتوبر, 8:05 صبح');
    expect(shortDate(null, 'ur')).toBe('—');
  });

  it('time ago', () => {
    const now = Date.UTC(2026, 9, 6, 12);
    expect(timeAgo(now - 20_000, 'roman', now)).toBe('abhi abhi');
    expect(timeAgo(now - 5 * 60_000, 'ur', now)).toBe('5 منٹ پہلے');
    expect(timeAgo(now - 3 * 3_600_000, 'en', now)).toBe('3 h ago');
    expect(timeAgo(now - 49 * 3_600_000, 'roman', now)).toBe('2 din pehle');
  });

  it('values inside Urdu sentences keep their own direction (isolated); other languages are untouched', () => {
    expect(translate('ur', 'maal.ownerQty', { qty: '12 bori' })).toBe('مالک کا: ⁨12 bori⁩');
    expect(translate('roman', 'maal.ownerQty', { qty: '12' })).toBe('Malik ka: 12');
  });

  it('units, roles and sync entries are translated; unknown ones are shown as they are', () => {
    expect(unitLabel('ur', 'bag')).toBe('بوری');
    expect(unitLabel('roman', 'SQFT')).toBe('murabba fut');
    expect(unitLabel('ur', 'tanker')).toBe('tanker');
    expect(roleLabel('ur', 'MUNSHI', null)).toBe('منشی');
    expect(roleLabel('roman', 'PM', { key: 'STORE_KEEPER', name: 'Store Keeper' })).toBe('Store keeper');
    expect(roleLabel('ur', 'MUNSHI', { key: 'CUSTOM_7', name: 'Site Incharge' })).toBe('Site Incharge');
    expect(outboxTitle('ur', 'ADVANCE_CREATE')).toBe('پیشگی');
    expect(outboxTitle('en', 'SOMETHING_NEW')).toBeNull();
  });
});
