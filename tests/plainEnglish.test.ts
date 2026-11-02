/**
 * English must be plain English: when the user picks English, no Roman Urdu words are left in the
 * texts (hazri → attendance, peshgi → advance, kharcha → expense, munshi → site clerk …). Roman Urdu
 * and Urdu keep their own words. Keys, routes and API codes (MUNSHI, PESHGI …) are not checked.
 */
import { en } from '../src/i18n/en';

/** Roman Urdu words that are never English (a curated list — none of them is also an English word). */
const BANNED = [
  'udhaar', 'udhar', 'peshgi', 'munshi', 'munshis', 'hazri', 'haziri', 'thekedar', 'thekedaar', 'theka', 'khata',
  'dihari', 'mistri', 'mistris', 'mazdoor', 'mazdoors', 'mazdoori', 'lenter', 'bunyaad', 'chunai', 'bharai', 'khudai',
  'tarai', 'sariya', 'sarya', 'bajri', 'eent', 'kharcha', 'kharidari', 'rozana', 'maal', 'wapsi', 'hisaab', 'challan',
  'challans', 'garder', 'garders', 'mumty', 'chajja', 'deemak', 'mitti', 'ustad', 'mazeed', 'aaj', 'karein', 'nahi',
  'naya', 'nayi', 'adaigi', 'gaari', 'assalam', 'alaikum',
];
const BANNED_RE = new RegExp(`\\b(${BANNED.join('|')})\\b`, 'i');

/** The app itself is called "Keystone Munshi" (a brand name, kept in every language). */
const BRAND_KEYS = new Set(['app.name']);

const offenders = (texts: Record<string, string>) =>
  Object.entries(texts)
    .filter(([key]) => !BRAND_KEYS.has(key))
    .map(([key, text]) => {
      const hit = text.replace(/\{\w+\}/g, '').match(BANNED_RE);
      return hit ? `${key}: "${text}" (${hit[1]})` : null;
    })
    .filter(Boolean);

describe('English texts are plain English', () => {
  it('the English dictionary has no Roman Urdu words', () => {
    expect(offenders(en)).toEqual([]);
  });

  it('the role names say Owner and Site clerk', () => {
    expect(en['role.THEKEDAR']).toBe('Owner');
    expect(en['role.MUNSHI']).toBe('Site clerk');
  });

  it('the guard itself catches Roman Urdu and lets plain English through', () => {
    expect(offenders({ a: 'Save hazri', b: 'Recent peshgi', c: 'Add kharcha' })).toHaveLength(3);
    expect(offenders({ a: 'Save attendance', b: 'Recent advances', c: 'Add expense', 'app.name': 'Keystone Munshi' })).toEqual([]);
  });
});
