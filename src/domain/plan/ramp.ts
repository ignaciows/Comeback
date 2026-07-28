import type { ISODate, WorkoutSession } from '@/domain/types';
import { addDays, daysBetween, isWithinDays, startOfWeek } from '@/utils/date';
import { clamp, round } from '@/utils/math';

/**
 * Getting to the frequency the plan needs, from the one you actually have.
 *
 * A plan that requires five sessions a week, handed to someone doing two, is
 * not a plan — it is a way to fail in week one and conclude the app was wrong.
 * The requirement does not move; the path to it does.
 *
 * One extra session per two weeks is the rate used here. It comes from the
 * same reasoning behind the return-to-training literature: after a layoff, the
 * limit on adding work is connective tissue and habit rather than muscle, and
 * both take a couple of weeks per step to settle. It also survives contact
 * with real life — one more gym trip a fortnight is a change most people can
 * absorb without rearranging anything.
 */

export type RampStep = {
  /** 0-based, counted in weeks from the ramp's start. */
  index: number;
  /** Monday (or Sunday) of the week this step covers. */
  startsOn: ISODate;
  /** Sessions asked for during this week. */
  sessions: number;
  /** True once this step is at the plan's full requirement. */
  atTarget: boolean;
};

export type Ramp = {
  steps: RampStep[];
  startDays: number;
  targetDays: number;
  /** Weeks until the full requirement applies. Zero when already there. */
  weeksToTarget: number;
};

/** One more session a week every this many weeks. */
const WEEKS_PER_STEP = 2;

export type RampInput = {
  today: ISODate;
  /** Sessions a week the plan needs. */
  targetDays: number;
  /** Where to start. Measured when possible, declared otherwise. */
  startDays: number;
  weekStartsOn?: 0 | 1;
};

export function buildRamp({ today, targetDays, startDays, weekStartsOn = 1 }: RampInput): Ramp {
  const from = clamp(Math.round(startDays), 1, 7);
  const to = clamp(Math.round(targetDays), 1, 7);
  const firstWeek = startOfWeek(today, weekStartsOn);

  // Already there, or already doing more: one step, no climb.
  if (from >= to) {
    return {
      steps: [{ index: 0, startsOn: firstWeek, sessions: to, atTarget: true }],
      startDays: from,
      targetDays: to,
      weeksToTarget: 0,
    };
  }

  const steps: RampStep[] = [];
  let index = 0;
  for (let sessions = from; sessions < to; sessions += 1) {
    for (let repeat = 0; repeat < WEEKS_PER_STEP; repeat += 1) {
      steps.push({
        index,
        startsOn: addDays(firstWeek, index * 7),
        sessions,
        atTarget: false,
      });
      index += 1;
    }
  }

  steps.push({ index, startsOn: addDays(firstWeek, index * 7), sessions: to, atTarget: true });

  return { steps, startDays: from, targetDays: to, weeksToTarget: index };
}

/** What this week asks for. Past the end of the ramp, that is the full target. */
export function currentRampTarget(ramp: Ramp, today: ISODate, weekStartsOn: 0 | 1 = 1): number {
  const week = startOfWeek(today, weekStartsOn);
  const elapsed = Math.floor(daysBetween(ramp.steps[0].startsOn, week) / 7);
  if (elapsed < 0) return ramp.steps[0].sessions;
  return ramp.steps[Math.min(elapsed, ramp.steps.length - 1)].sessions;
}

/**
 * The frequency to start a ramp from: what the user is already doing.
 *
 * Deriving it beats asking. Someone who has trained twice a week for a month
 * knows they train twice a week, and typing "4" into a form does not make it
 * so. With no history at all there is nothing to measure, and the caller falls
 * back to what was declared.
 */
export function observedSessionsPerWeek(
  sessions: WorkoutSession[],
  today: ISODate,
  windowDays = 28,
): number | null {
  const completed = sessions.filter(
    (session) => session.status === 'completed' && isWithinDays(session.date, today, windowDays),
  );
  if (completed.length < 2) return null;

  // Measure over the span actually covered, so a user two weeks in is not
  // averaged against four weeks of silence that never happened.
  const dates = completed.map((session) => session.date).sort();
  const spanDays = Math.max(7, daysBetween(dates[0], today) + 1);
  return round((completed.length / spanDays) * 7, 1);
}
