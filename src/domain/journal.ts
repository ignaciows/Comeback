import type {
  BodyMeasurement,
  DailyCheckin,
  ISODate,
  PlannedSession,
  WorkoutSession,
} from '@/domain/types';
import { addDays, lastNDays } from '@/utils/date';

/**
 * What happened on each day, as one row per calendar day.
 *
 * Everything the app records is already stamped with a date; this gathers it
 * so a day can be looked at as a day rather than as four separate lists. It is
 * what the grid of squares is drawn from, and what tapping one of them opens.
 *
 * A day is `missed` only when something was actually planned for it and did
 * not happen. A day with nothing planned and nothing logged is a rest day, not
 * a failure — the distinction matters more than almost anything else in the
 * app, because the opposite framing is what makes people quit.
 */

export type JournalDay = {
  date: ISODate;
  session: WorkoutSession | null;
  checkin: DailyCheckin | null;
  weight: BodyMeasurement | null;
  /** Something was scheduled for this day. */
  wasPlanned: boolean;
  state: 'trained' | 'logged' | 'rest' | 'missed' | 'today' | 'future';
};

export type JournalInput = {
  today: ISODate;
  days: number;
  sessions: WorkoutSession[];
  plannedSessions: PlannedSession[];
  checkins: DailyCheckin[];
  measurements: BodyMeasurement[];
};

export function buildJournal({
  today,
  days,
  sessions,
  plannedSessions,
  checkins,
  measurements,
}: JournalInput): JournalDay[] {
  const sessionByDate = new Map<ISODate, WorkoutSession>();
  for (const session of sessions) {
    if (session.status === 'completed') sessionByDate.set(session.date, session);
  }

  const checkinByDate = new Map(checkins.map((entry) => [entry.date, entry]));
  const weightByDate = new Map(measurements.map((entry) => [entry.date, entry]));
  const plannedByDate = new Map(plannedSessions.map((entry) => [entry.date, entry]));

  return lastNDays(today, days).map((date) => {
    const session = sessionByDate.get(date) ?? null;
    const checkin = checkinByDate.get(date) ?? null;
    const weight = weightByDate.get(date) ?? null;
    const planned = plannedByDate.get(date) ?? null;
    const wasPlanned = planned !== null && planned.status !== 'rest';

    let state: JournalDay['state'];
    if (date > today) state = 'future';
    else if (session) state = 'trained';
    else if (date === today) state = 'today';
    else if (checkin || weight) state = 'logged';
    else if (wasPlanned && planned?.status !== 'rescheduled') state = 'missed';
    else state = 'rest';

    return { date, session, checkin, weight, wasPlanned, state };
  });
}

/** Days ahead, so the grid shows what is still to fill as well as what is done. */
export function futureDays(from: ISODate, count: number, plannedSessions: PlannedSession[]): JournalDay[] {
  const plannedByDate = new Map(plannedSessions.map((entry) => [entry.date, entry]));

  return Array.from({ length: count }, (_, index) => {
    const date = addDays(from, index + 1);
    const planned = plannedByDate.get(date) ?? null;
    return {
      date,
      session: null,
      checkin: null,
      weight: null,
      wasPlanned: planned !== null && planned.status !== 'rest',
      state: 'future' as const,
    };
  });
}

export type JournalSummary = {
  trained: number;
  logged: number;
  missed: number;
  /** Longest run of consecutive days with something on them. */
  streak: number;
};

export function summariseJournal(days: JournalDay[]): JournalSummary {
  let streak = 0;
  let best = 0;

  for (const day of days) {
    if (day.state === 'trained' || day.state === 'logged') {
      streak += 1;
      best = Math.max(best, streak);
    } else if (day.state !== 'future' && day.state !== 'today') {
      streak = 0;
    }
  }

  return {
    trained: days.filter((day) => day.state === 'trained').length,
    logged: days.filter((day) => day.state === 'logged').length,
    missed: days.filter((day) => day.state === 'missed').length,
    streak: best,
  };
}
