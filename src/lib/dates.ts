import { formatInTimeZone } from 'date-fns-tz';
import { en } from '../i18n/en';
import { roman } from '../i18n/roman';
import { ur } from '../i18n/ur';

export const TIME_ZONE = 'Asia/Karachi';

/** The app languages (same as `Language` in src/i18n; repeated here so dates need no React). */
type Lang = 'roman' | 'en' | 'ur';
const dict = (lang: Lang) => (lang === 'en' ? en : lang === 'ur' ? ur : roman);

/** Today in Pakistan, "2026-10-06". */
export const todayPK = (now: Date = new Date()) => formatInTimeZone(now, TIME_ZONE, 'yyyy-MM-dd');

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
export type WeekDay = (typeof WEEKDAYS)[number];

/** The settlement week containing `day` (week start from the company settings). */
export function weekOf(day: string, weekStart: WeekDay = 'MONDAY'): { weekStart: string; weekEnd: string; days: string[] } {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  const back = (d - WEEKDAYS.indexOf(weekStart) + 7) % 7;
  const start = addDays(day, -back);
  return { weekStart: start, weekEnd: addDays(start, 6), days: Array.from({ length: 7 }, (_, i) => addDays(start, i)) };
}

// Month and weekday names come from the dictionaries (date.m1…m12, date.wd0…wd6, date.wn0…wn6),
// so they are checked by the missing-key test like every other text. Digits stay Western in all languages.
const parts = (day: string) => {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number);
  return { y: y!, m: m!, d: d!, wd: new Date(`${day.slice(0, 10)}T00:00:00Z`).getUTCDay() };
};
const month = (lang: Lang, m: number) => dict(lang)[`date.m${m}` as keyof typeof en];

/** "6 Oct" / "6 اکتوبر" */
export const shortDate = (day: string | null | undefined, lang: Lang = 'en') => {
  if (!day) return '—';
  const p = parts(day);
  return `${p.d} ${month(lang, p.m)}`;
};
/** "6 Oct 2026" */
export const longDate = (day: string | null | undefined, lang: Lang = 'en') => {
  if (!day) return '—';
  const p = parts(day);
  return `${p.d} ${month(lang, p.m)} ${p.y}`;
};
/** "6 Oct, 2:15 PM" (Pakistan time) */
export const dateTime = (iso: string | null | undefined, lang: Lang = 'en') => {
  if (!iso) return '—';
  const local = formatInTimeZone(new Date(iso), TIME_ZONE, 'yyyy-MM-dd H mm');
  const [day, h, mm] = local.split(' ');
  const hour = Number(h);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${shortDate(day, lang)}, ${h12}:${mm} ${dict(lang)[hour < 12 ? 'date.am' : 'date.pm']}`;
};
/** "Mon" / "Peer" / "پیر" */
export const weekDayShort = (day: string, lang: Lang = 'en') => dict(lang)[`date.wd${parts(day).wd}` as keyof typeof en];
/** Column heads of the week grid: "Mo" / "Pe" / "پیر" */
export const weekDayNarrow = (day: string, lang: Lang = 'en') => dict(lang)[`date.wn${parts(day).wd}` as keyof typeof en];

/** "5 min ago" for the last sync time. */
export function timeAgo(when: number | Date, lang: Lang = 'en', now: number = Date.now()): string {
  const t = dict(lang);
  const mins = Math.max(0, Math.floor((now - (typeof when === 'number' ? when : when.getTime())) / 60000));
  if (mins < 1) return t['time.justNow'];
  if (mins < 60) return t['time.minutes'].replace('{n}', String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t['time.hours'].replace('{n}', String(hours));
  return t['time.days'].replace('{n}', String(Math.floor(hours / 24)));
}
