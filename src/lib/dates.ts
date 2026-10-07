import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export const TIME_ZONE = 'Asia/Karachi';

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

/** "6 Oct" */
export const shortDate = (day: string | null | undefined) => (day ? format(new Date(`${day.slice(0, 10)}T00:00:00`), 'd MMM') : '—');
/** "6 Oct 2026" */
export const longDate = (day: string | null | undefined) => (day ? format(new Date(`${day.slice(0, 10)}T00:00:00`), 'd MMM yyyy') : '—');
/** "6 Oct, 2:15 PM" (Pakistan time) */
export const dateTime = (iso: string | null | undefined) => (iso ? formatInTimeZone(new Date(iso), TIME_ZONE, 'd MMM, h:mm a') : '—');
export const weekDayShort = (day: string) => format(new Date(`${day}T00:00:00`), 'EEE');
