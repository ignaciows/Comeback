import type { FollowedRoute } from '@/domain/plan/routes';
import type {
  FatTolerance,
  ISODate,
  ISODateTime,
  MuscleGroup,
  NutritionStrategy,
  PlanObjective,
  PlanSpeed,
  WorkoutSession,
} from '@/domain/types';
import { daysBetween } from '@/utils/date';
import { round } from '@/utils/math';

/**
 * The plans you used to be on, so that changing your mind is reversible.
 *
 * Changing a plan today is a one-way door: the new numbers overwrite the old
 * ones and the only way back is to remember what they were and re-enter them.
 * That makes trying a different approach feel expensive, so people either
 * never try or they try and then quietly stop using the app.
 *
 * A snapshot is taken **before** every change, so there is always something to
 * go back to. Two things matter about what it holds:
 *
 *  · It stores the *plan* — the goal, the schedule, the route — and nothing
 *    else. Sessions, weigh-ins and check-ins are facts about what happened;
 *    they are not part of the plan and reverting must never touch them. Going
 *    back to last month's plan does not un-train you.
 *
 *  · It stores why. "Went from steady to fast" is the sentence someone needs
 *    six weeks later when they are deciding whether to undo it.
 */

export type PlanSnapshot = {
  id: string;
  takenOn: ISODate;
  at: ISODateTime;
  /** What the change was, in the user's terms. */
  reason: string;
  goal: {
    objective: PlanObjective;
    speed: PlanSpeed;
    strategy: NutritionStrategy;
    fatTolerance: FatTolerance;
    targetWeightKg: number | null;
    horizonWeeks: number;
    muscleFocus: MuscleGroup[];
  };
  training: {
    preferredDaysPerWeek: number;
    preferredWeekdays: number[];
    sessionMinutes: number;
  };
  planRoute: (FollowedRoute & { startedAt: ISODate }) | null;
};

/**
 * How many to keep.
 *
 * Enough to undo a run of changes made in one sitting, not so many that the
 * list becomes an archive nobody reads. The oldest fall off.
 */
export const MAX_SNAPSHOTS = 8;

export function pushSnapshot(history: PlanSnapshot[], snapshot: PlanSnapshot): PlanSnapshot[] {
  return [...history, snapshot].slice(-MAX_SNAPSHOTS);
}

/** The plan to offer going back to: the most recent one before now. */
export function previousPlan(history: PlanSnapshot[]): PlanSnapshot | null {
  return history.length > 0 ? history[history.length - 1] : null;
}

export type PlanDifference = {
  label: string;
  from: string;
  to: string;
};

const SPEED_LABEL: Record<PlanSpeed, string> = {
  cautious: 'Cautious',
  steady: 'Steady',
  fast: 'Fast',
  max: 'Maximum',
};

const OBJECTIVE_LABEL: Record<PlanObjective, string> = {
  build: 'Build muscle',
  lean: 'Lose fat',
  recomp: 'Recomposition',
};

/**
 * What actually changes if you go back, field by field.
 *
 * Shown on the confirmation, because "revert your plan?" is not a question
 * anyone can answer. "Fast becomes steady, five days becomes four, target goes
 * from 84 kg back to 80 kg" is.
 */
export function differencesFrom(
  snapshot: PlanSnapshot,
  current: Pick<PlanSnapshot, 'goal' | 'training'>,
): PlanDifference[] {
  const out: PlanDifference[] = [];

  const add = (label: string, from: unknown, to: unknown) => {
    if (String(from) === String(to)) return;
    out.push({ label, from: String(from), to: String(to) });
  };

  add('Objective', OBJECTIVE_LABEL[current.goal.objective], OBJECTIVE_LABEL[snapshot.goal.objective]);
  add('Pace', SPEED_LABEL[current.goal.speed], SPEED_LABEL[snapshot.goal.speed]);
  add(
    'Target weight',
    current.goal.targetWeightKg === null ? 'None' : `${current.goal.targetWeightKg} kg`,
    snapshot.goal.targetWeightKg === null ? 'None' : `${snapshot.goal.targetWeightKg} kg`,
  );
  add('Horizon', `${current.goal.horizonWeeks} weeks`, `${snapshot.goal.horizonWeeks} weeks`);
  add(
    'Days a week',
    current.training.preferredDaysPerWeek,
    snapshot.training.preferredDaysPerWeek,
  );
  add('Session length', `${current.training.sessionMinutes} min`, `${snapshot.training.sessionMinutes} min`);

  const focusOf = (muscles: MuscleGroup[]) => (muscles.length === 0 ? 'Balanced' : `${muscles.length} chosen`);
  add('Muscle focus', focusOf(current.goal.muscleFocus), focusOf(snapshot.goal.muscleFocus));

  return out;
}

export type RevertSuggestion = {
  snapshot: PlanSnapshot;
  /** Sessions a week before the change, and since. */
  beforeRate: number;
  afterRate: number;
  headline: string;
  detail: string;
};

/** A change has to have been live this long before its effect means anything. */
const MIN_DAYS_LIVE = 10;
/** And this much worse before it is worth raising. */
const WORSE_BY = 0.7;

/**
 * Whether to offer going back.
 *
 * Only on evidence, and only about behaviour the app can actually see: the
 * plan changed, enough time has passed to judge it, and training has dropped
 * off since. That is the honest reading of "the new plan is not working" —
 * not that the numbers are wrong, but that it is not being followed.
 *
 * Deliberately quiet: no suggestion in the first days, and none when the drop
 * is small. Being asked "want to give up on this?" every week is its own kind
 * of discouragement.
 */
export function revertSuggestion(
  history: PlanSnapshot[],
  sessions: WorkoutSession[],
  today: ISODate,
): RevertSuggestion | null {
  const snapshot = previousPlan(history);
  if (!snapshot) return null;

  const daysLive = daysBetween(snapshot.takenOn, today);
  if (daysLive < MIN_DAYS_LIVE) return null;

  const completed = sessions.filter((session) => session.status === 'completed');
  const windowDays = Math.min(daysLive, 28);

  const since = completed.filter(
    (session) => session.date >= snapshot.takenOn && session.date <= today,
  ).length;

  // The same length of time before the change, so the two rates are comparable.
  const beforeStart = shift(snapshot.takenOn, -windowDays);
  const before = completed.filter(
    (session) => session.date >= beforeStart && session.date < snapshot.takenOn,
  ).length;

  const afterRate = round((since / daysLive) * 7, 2);
  const beforeRate = round((before / windowDays) * 7, 2);

  // Nothing to compare against: someone who never trained before the change
  // is not being told the change is why.
  if (beforeRate <= 0) return null;
  if (afterRate > beforeRate - WORSE_BY) return null;

  return {
    snapshot,
    beforeRate,
    afterRate,
    headline: 'This plan is not sticking',
    detail: `${afterRate.toFixed(1)} sessions a week since the change, against ${beforeRate.toFixed(
      1,
    )} before it. The plan you were on is still here.`,
  };
}

function shift(date: ISODate, days: number): ISODate {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10) as ISODate;
}
