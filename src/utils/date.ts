import type { ISODate, ISODateTime } from '@/domain/types';

/**
 * Dates are handled as local calendar days (`YYYY-MM-DD`). Everything here is
 * timezone-stable: no UTC conversion happens on a day boundary.
 */

export function toISODate(date: Date): ISODate {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromISODate(value: ISODate): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function today(now: Date = new Date()): ISODate {
  return toISODate(now);
}

export function nowISO(now: Date = new Date()): ISODateTime {
  return now.toISOString();
}

export function addDays(value: ISODate, days: number): ISODate {
  const date = fromISODate(value);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: ISODate, to: ISODate): number {
  const ms = fromISODate(to).getTime() - fromISODate(from).getTime();
  return Math.round(ms / 86_400_000);
}

/** Inclusive list of the `count` days ending at `end`. */
export function lastNDays(end: ISODate, count: number): ISODate[] {
  return Array.from({ length: count }, (_, index) => addDays(end, -(count - 1 - index)));
}

export function isWithinDays(date: ISODate, end: ISODate, days: number): boolean {
  const diff = daysBetween(date, end);
  return diff >= 0 && diff < days;
}

export function weekdayOf(date: ISODate): number {
  return fromISODate(date).getDay();
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? '';
}

/** "18 October" — the format used for target dates. */
export function formatLongDate(date: ISODate): string {
  const parsed = fromISODate(date);
  return `${parsed.getDate()} ${MONTH_LABELS[parsed.getMonth()]}`;
}

/** "Mon 18 Oct" — compact, used in history rows. */
export function formatShortDate(date: ISODate): string {
  const parsed = fromISODate(date);
  return `${WEEKDAY_LABELS[parsed.getDay()]} ${parsed.getDate()} ${MONTH_LABELS[parsed.getMonth()].slice(0, 3)}`;
}

export function formatRelativeDay(date: ISODate, reference: ISODate): string {
  const diff = daysBetween(date, reference);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff === -1) return 'Tomorrow';
  if (diff > 1 && diff < 7) return `${diff} days ago`;
  return formatShortDate(date);
}

/** Start of the week containing `date`. */
export function startOfWeek(date: ISODate, weekStartsOn: 0 | 1 = 1): ISODate {
  const weekday = weekdayOf(date);
  const diff = (weekday - weekStartsOn + 7) % 7;
  return addDays(date, -diff);
}

export function greetingFor(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** Elapsed time as `MM:SS`, or `H:MM:SS` past an hour. */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = `${minutes}`.padStart(hours > 0 ? 2 : 1, '0');
  const ss = `${secs}`.padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
