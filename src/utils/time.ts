export type TimeOfDay = 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening';

/** Coarse period of the day, used for ambient tone and copy. */
export function timeOfDay(now: Date = new Date()): TimeOfDay {
  const hour = now.getHours();
  if (hour < 5) return 'night';
  if (hour < 8) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  if (hour < 23) return 'evening';
  return 'night';
}

/** How the app refers to the current window, e.g. "this evening". */
export function timeOfDayPhrase(period: TimeOfDay): string {
  switch (period) {
    case 'night':
      return 'tonight';
    case 'dawn':
      return 'this morning';
    case 'morning':
      return 'this morning';
    case 'afternoon':
      return 'this afternoon';
    case 'evening':
      return 'this evening';
  }
}

/** "14:05" in 24-hour time. */
export function formatClock(now: Date = new Date()): string {
  return `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
}

/** "just now", "4m ago", "2h ago" — for the live-update line. */
export function formatSince(fromMs: number, nowMs: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
