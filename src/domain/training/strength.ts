import { estimateOneRepMax } from '@/domain/training/assessment';
import type { ISODate, WorkoutSession } from '@/domain/types';
import { daysBetween, startOfWeek } from '@/utils/date';
import { round } from '@/utils/math';

/**
 * What you lift on each movement, and how that has compounded.
 *
 * The app already picks the next weight set by set. What it could not do was
 * answer the question people actually care about after a month: *am I
 * stronger, and by how much*. Session-by-session numbers do not answer it —
 * one heavy day and one bad day look the same on a list — and the weight
 * alone is not comparable either, because 80 kg for five and 70 kg for twelve
 * are not the same performance.
 *
 * So everything here is expressed in **estimated one-rep max**, which is the
 * only number that compares across rep ranges. It is not a claim about what
 * you could actually lift once; it is a common scale, and the trend on it is
 * the honest measure of whether the load is compounding.
 *
 * Nothing is projected past what the data supports. Two sessions is not a
 * trend, and a weekly rate from two points would be a straight line drawn
 * through noise and then trusted.
 */

export type WeekPoint = {
  /** Monday of the week, so points are comparable across a long history. */
  weekStart: ISODate;
  /** Best estimated one-rep max in that week. */
  estimatedMaxKg: number;
  /** The set it came from. */
  weightKg: number;
  reps: number;
  sets: number;
};

export type ExerciseStrength = {
  exerciseId: string;
  /** Most recent week with work in it. */
  current: WeekPoint;
  /** The first week on record. */
  first: WeekPoint;
  /** Change in estimated max, in kg. */
  changeKg: number;
  /** Change as a share of where it started. */
  changePct: number;
  /** Weeks between the first and current points. Zero when they are the same. */
  weeksSpanned: number;
  /**
   * Kilos of estimated max added per week. Null until there is enough of a
   * span for the number to mean anything.
   */
  perWeekKg: number | null;
  history: WeekPoint[];
  /** Total working sets ever logged on this movement. */
  totalSets: number;
};

/** Below this many weeks apart, a rate is noise dressed as a trend. */
const MIN_WEEKS_FOR_RATE = 3;

/** A movement needs this many separate weeks before it gets a trend at all. */
const MIN_WEEKS_ON_RECORD = 2;

export function strengthByExercise(sessions: WorkoutSession[]): ExerciseStrength[] {
  const byExercise = new Map<string, Map<ISODate, WeekPoint>>();
  const setCounts = new Map<string, number>();

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    const week = startOfWeek(session.date);

    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (!set.completed || set.warmup) continue;
        if (set.weightKg === null || set.reps === null) continue;

        const estimate = estimateOneRepMax(set.weightKg, set.reps);
        if (estimate === null) continue;

        setCounts.set(exercise.exerciseId, (setCounts.get(exercise.exerciseId) ?? 0) + 1);

        const weeks = byExercise.get(exercise.exerciseId) ?? new Map<ISODate, WeekPoint>();
        const existing = weeks.get(week);

        // Best set of the week represents the week: a deload Tuesday should not
        // erase what Friday proved.
        if (!existing || estimate > existing.estimatedMaxKg) {
          weeks.set(week, {
            weekStart: week,
            estimatedMaxKg: estimate,
            weightKg: set.weightKg,
            reps: set.reps,
            sets: (existing?.sets ?? 0) + 1,
          });
        } else {
          weeks.set(week, { ...existing, sets: existing.sets + 1 });
        }

        byExercise.set(exercise.exerciseId, weeks);
      }
    }
  }

  const out: ExerciseStrength[] = [];

  for (const [exerciseId, weeks] of byExercise) {
    const history = [...weeks.values()].sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
    if (history.length === 0) continue;

    const first = history[0];
    const current = history[history.length - 1];
    const weeksSpanned = Math.round(daysBetween(first.weekStart, current.weekStart) / 7);

    const changeKg = round(current.estimatedMaxKg - first.estimatedMaxKg, 1);

    out.push({
      exerciseId,
      current,
      first,
      changeKg,
      changePct: first.estimatedMaxKg === 0 ? 0 : round((changeKg / first.estimatedMaxKg) * 100, 1),
      weeksSpanned,
      perWeekKg:
        history.length >= MIN_WEEKS_ON_RECORD && weeksSpanned >= MIN_WEEKS_FOR_RATE
          ? round(changeKg / weeksSpanned, 2)
          : null,
      history,
      totalSets: setCounts.get(exerciseId) ?? 0,
    });
  }

  // Most-trained first: the movements someone actually cares about are the
  // ones they keep doing.
  return out.sort((a, b) => b.totalSets - a.totalSets);
}

export type StrengthSummary = {
  /** Movements with a real trend, best improvement first. */
  moving: ExerciseStrength[];
  /** Trained, but not for long enough to say anything yet. */
  tooEarly: ExerciseStrength[];
  /** Total estimated max added across everything with a trend. */
  totalAddedKg: number;
  headline: string;
};

export function summariseStrength(sessions: WorkoutSession[]): StrengthSummary {
  const all = strengthByExercise(sessions);
  const moving = all
    .filter((entry) => entry.perWeekKg !== null)
    .sort((a, b) => b.changeKg - a.changeKg);
  const tooEarly = all.filter((entry) => entry.perWeekKg === null);

  const totalAddedKg = round(
    moving.reduce((total, entry) => total + Math.max(0, entry.changeKg), 0),
    1,
  );

  return {
    moving,
    tooEarly,
    totalAddedKg,
    headline:
      moving.length === 0
        ? 'A few more weeks of logging and the trend on each lift appears here.'
        : `${totalAddedKg} kg added across ${moving.length} movement${moving.length === 1 ? '' : 's'}.`,
  };
}

/**
 * What the next session should be reaching for.
 *
 * Deliberately one increment, not an extrapolation of the observed rate.
 * Someone adding 3 kg a week for six weeks is not going to keep doing that,
 * and prescribing as if they will is how a plan stops being followable. The
 * rate is worth showing; it is not worth predicting from.
 */
export function nextTarget(entry: ExerciseStrength, incrementKg = 2.5): {
  weightKg: number;
  reps: number;
  reason: string;
} {
  return {
    weightKg: round(entry.current.weightKg + incrementKg, 1),
    reps: entry.current.reps,
    reason:
      entry.perWeekKg === null
        ? `Last time: ${entry.current.weightKg} kg for ${entry.current.reps}.`
        : `Up ${entry.changeKg} kg since you started this one.`,
  };
}

/**
 * When a lift has stopped moving, and what to do about it.
 *
 * Progressive overload only describes what happens while progress happens.
 * The interesting case is the other one: three weeks at the same estimated max
 * is not bad luck, it is information, and a plan that keeps prescribing "add
 * 2.5 kg" into a wall is a plan that stops being followed.
 *
 * The response is a deload, not more effort. Repeating a week at reduced load
 * lets accumulated fatigue clear, and the same weight that would not move
 * usually moves the week after. Adding sets to something already stuck is the
 * instinct and the wrong one.
 */

export type Stall = {
  exerciseId: string;
  /** Consecutive weeks without a new best. */
  weeks: number;
  headline: string;
  detail: string;
  /** What to put on the bar for a deload week. */
  deloadKg: number;
};

/** Weeks without a new best before it counts as stuck rather than a bad day. */
export const STALL_WEEKS = 3;

/** How much comes off for the deload week. */
const DELOAD = 0.9;

export function detectStall(entry: ExerciseStrength): Stall | null {
  if (entry.history.length < STALL_WEEKS) return null;

  const best = Math.max(...entry.history.map((point) => point.estimatedMaxKg));

  // The week the current best was *first* reached. Using the last week that
  // matched it would call four weeks of repeating the same number "progress",
  // which is exactly the situation this exists to catch.
  let bestIndex = 0;
  for (let index = 0; index < entry.history.length; index += 1) {
    if (entry.history[index].estimatedMaxKg >= best) {
      bestIndex = index;
      break;
    }
  }

  const weeksSince = entry.history.length - 1 - bestIndex;
  if (weeksSince < STALL_WEEKS - 1) return null;

  const step = 2.5;
  const deloadKg = Math.max(step, Math.round((entry.current.weightKg * DELOAD) / step) * step);

  return {
    exerciseId: entry.exerciseId,
    weeks: weeksSince + 1,
    headline: 'This one has stopped moving',
    detail: `No new best in ${weeksSince + 1} weeks. Take a week at ${deloadKg} kg to let the fatigue clear — the same weight usually moves the week after.`,
    deloadKg: round(deloadKg, 1),
  };
}

/** Every lift that is stuck, most-trained first. */
export function stalls(sessions: WorkoutSession[]): Stall[] {
  return strengthByExercise(sessions)
    .map(detectStall)
    .filter((stall): stall is Stall => stall !== null);
}
