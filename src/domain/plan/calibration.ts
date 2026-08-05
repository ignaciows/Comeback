import type { PlanBlock, PlanRoute } from '@/domain/plan/routes';
import type { ISODate, WorkoutSession } from '@/domain/types';
import { addDays, daysBetween } from '@/utils/date';
import { clamp, round } from '@/utils/math';

/**
 * Two weeks of calibration before the plan the user actually chose.
 *
 * Starting a twenty-four month plan on day one means every number in it is
 * built on figures nobody has measured: a starting strength guessed from a
 * questionnaire, a session length nobody has timed, an adherence assumed to be
 * perfect. The plan is then confidently wrong for months, and the person
 * quietly concludes the app does not know them.
 *
 * So the first fortnight does less on purpose. Fewer exercises, all of them
 * the basic patterns, at a frequency that is easy to hit — and while that runs
 * the app is measuring what it had been guessing. At the end of week two it
 * has real numbers and rebuilds the plan around them.
 *
 * The important part is that this is explained *before* it starts. Someone who
 * asked for an ambitious plan and silently receives an easy one concludes the
 * app has ignored them; the same fortnight, announced, reads as the app taking
 * them seriously enough to measure first.
 */

export const CALIBRATION_ROUTE_ID = 'calibration_then_plan';

/** Long enough for two full passes of every basic pattern, and no longer. */
export const CALIBRATION_DAYS = 14;
export const CALIBRATION_WEEKS = 2;

/**
 * Three, whatever the plan asks for afterwards.
 *
 * The point of the fortnight is data, and data needs sessions that happen. A
 * five-day week that gets hit three times measures adherence, not strength.
 */
export const CALIBRATION_DAYS_PER_WEEK = 3;

/**
 * The five patterns everything else is built out of.
 *
 * Deliberately the compound lifts and nothing else: these are the ones whose
 * loads the rest of the plan is derived from, and an accessory nobody has a
 * baseline for teaches the app nothing it can use.
 */
export const CALIBRATION_LIFTS = [
  'back_squat',
  'barbell_bench_press',
  'barbell_row',
  'overhead_press',
  'deadlift',
] as const;

export type CalibrationWindow = {
  startedAt: ISODate;
  endsOn: ISODate;
  dayNumber: number;
  daysLeft: number;
  /** 0–1 through the fortnight. */
  progress: number;
  complete: boolean;
};

export function calibrationWindow(startedAt: ISODate, today: ISODate): CalibrationWindow {
  const elapsed = daysBetween(startedAt, today);
  const dayNumber = clamp(elapsed + 1, 1, CALIBRATION_DAYS);

  return {
    startedAt,
    endsOn: addDays(startedAt, CALIBRATION_DAYS),
    dayNumber,
    daysLeft: Math.max(0, CALIBRATION_DAYS - elapsed),
    progress: round(clamp(elapsed / CALIBRATION_DAYS, 0, 1), 2),
    complete: elapsed >= CALIBRATION_DAYS,
  };
}

/** The calibration block, shaped like any other block of a route. */
export function calibrationBlock(): PlanBlock {
  // Maintenance, because a surplus or a deficit during the fortnight would
  // move the scale and contaminate the very baseline being taken.
  return { strategy: 'maintain', weeks: CALIBRATION_WEEKS, label: 'Calibration' };
}

/**
 * Any route, with the fortnight in front of it.
 *
 * The chosen route is not modified — its blocks follow the calibration block
 * unchanged — so what the user picked is still what they get, two weeks later
 * and built on measurements.
 */
export function withCalibration(route: PlanRoute): PlanRoute {
  return {
    id: CALIBRATION_ROUTE_ID,
    name: `Calibration, then ${route.name.toLowerCase()}`,
    summary: `Two weeks measuring what you can actually do, then ${route.summary.toLowerCase()}`,
    bestFor: 'Starting out, or coming back, where nobody has measured anything yet.',
    blocks: [calibrationBlock(), ...route.blocks],
  };
}

/** Whether a route is one of these. Blocks travel with the plan, so check the id. */
export function isCalibrationRoute(routeId: string | null | undefined): boolean {
  return routeId === CALIBRATION_ROUTE_ID;
}

export type CalibrationReadout = {
  sessionsDone: number;
  sessionsExpected: number;
  /** Basic lifts with at least one completed working set. */
  liftsMeasured: string[];
  liftsRemaining: string[];
  /** Median minutes of actual training, once there is anything to measure. */
  medianSessionMinutes: number | null;
  /** True once there is enough to rebuild the plan on rather than guesses. */
  enoughToRebuild: boolean;
};

/**
 * What the fortnight actually established.
 *
 * `enoughToRebuild` is deliberately not "the fourteen days elapsed". Someone
 * who trained twice has not given the app a baseline, and rebuilding a
 * two-year plan on two sessions would be the same confident guessing the
 * calibration exists to avoid — it would just have taken a fortnight to do.
 */
export function calibrationReadout(
  sessions: WorkoutSession[],
  window: CalibrationWindow,
): CalibrationReadout {
  const inWindow = sessions.filter(
    (session) =>
      session.status === 'completed' &&
      session.date >= window.startedAt &&
      session.date <= window.endsOn,
  );

  const measured = new Set<string>();
  for (const session of inWindow) {
    for (const exercise of session.exercises) {
      const worked = exercise.sets.some((set) => set.completed && !set.warmup);
      if (worked) measured.add(exercise.exerciseId);
    }
  }

  const liftsMeasured = CALIBRATION_LIFTS.filter((lift) => measured.has(lift));
  const minutes = inWindow
    .map((session) => trainingMinutes(session))
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  const sessionsExpected = CALIBRATION_DAYS_PER_WEEK * CALIBRATION_WEEKS;

  return {
    sessionsDone: inWindow.length,
    sessionsExpected,
    liftsMeasured: [...liftsMeasured],
    liftsRemaining: CALIBRATION_LIFTS.filter((lift) => !measured.has(lift)),
    medianSessionMinutes: minutes.length === 0 ? null : minutes[Math.floor(minutes.length / 2)],
    // Four of the six planned sessions and three of the five patterns: enough
    // that the numbers are observations rather than a rounding of one day.
    enoughToRebuild: inWindow.length >= 4 && liftsMeasured.length >= 3,
  };
}

function trainingMinutes(session: WorkoutSession): number | null {
  if (!session.endedAt) return null;
  const elapsed = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  const paused = (session.pauses ?? []).reduce((total, pause) => {
    if (!pause.endedAt) return total;
    return total + (new Date(pause.endedAt).getTime() - new Date(pause.startedAt).getTime());
  }, 0);
  return Math.max(0, Math.round((elapsed - paused) / 60_000));
}
