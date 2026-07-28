import type { DailyCheckin, ISODate, PlanObjective, PlanSpeed, WorkoutSession } from '@/domain/types';
import { isWithinDays } from '@/utils/date';
import { clamp, mean, round } from '@/utils/math';

/**
 * What a plan asks of you, and whether you are doing it.
 *
 * A plan is not a wish — it is a set of conditions. Picking the fast route and
 * training twice a week does not produce the fast result; it produces a slower
 * one with a wrong date attached. So every requirement is stated as a number,
 * measured where the app honestly can, and left explicitly unmeasured where it
 * cannot.
 *
 * That last part matters. The app sees every session, so frequency and logging
 * are facts. It has no idea what you ate. Showing a green tick next to a
 * calorie target it cannot check would be the single most dishonest thing in
 * the whole app.
 */

export type CommitmentId = 'frequency' | 'logging' | 'calories' | 'protein' | 'sleep';

export type Commitment = {
  id: CommitmentId;
  /** Two or three words. */
  label: string;
  required: number;
  /** What the app measured. Null when it genuinely cannot know. */
  observed: number | null;
  unit: string;
  /** Null when unmeasurable — never a guess dressed as a verdict. */
  met: boolean | null;
  /** Observed over required, capped at 1.5 so one big week cannot mask a bad month. */
  ratio: number | null;
  /** Why it is unmeasured, or what the measurement is over. */
  note: string;
};

const SESSIONS_TABLE: Record<PlanObjective, Record<PlanSpeed, number>> = {
  build: { cautious: 3, steady: 4, fast: 5, max: 6 },
  lean: { cautious: 3, steady: 3, fast: 4, max: 5 },
  recomp: { cautious: 4, steady: 4, fast: 5, max: 6 },
};

/**
 * Reading a plan value that came out of storage.
 *
 * Data written by an older build can be missing fields the current one indexes
 * tables with, and an unguarded double lookup takes the whole app down on
 * launch — which is exactly how this app has broken before. Every table keyed
 * by something the user's device persisted goes through a resolver like this
 * one, the same way `strategyProfile` does.
 */
export function asObjective(value: unknown): PlanObjective {
  return value === 'build' || value === 'lean' || value === 'recomp' ? value : 'recomp';
}

export function asSpeed(value: unknown): PlanSpeed {
  return value === 'cautious' || value === 'steady' || value === 'fast' || value === 'max'
    ? value
    : 'steady';
}

/** Sessions a week each pace needs. Below this the pace is a different pace. */
export function requiredSessionsPerWeek(objective: unknown, speed: unknown): number {
  return SESSIONS_TABLE[asObjective(objective)][asSpeed(speed)];
}

export type CommitmentInput = {
  today: ISODate;
  sessions: WorkoutSession[];
  checkins: DailyCheckin[];
  /** Sessions a week the chosen plan needs. */
  requiredSessions: number;
  requiredKcal: number;
  requiredProteinG: number;
  /** How far back the measurement looks. */
  windowDays?: number;
};

/** Sleep under this drags recovery and, with it, the plan's assumptions. */
const SLEEP_TARGET_HOURS = 7;

export function evaluateCommitments({
  today,
  sessions,
  checkins,
  requiredSessions,
  requiredKcal,
  requiredProteinG,
  windowDays = 28,
}: CommitmentInput): Commitment[] {
  const window = sessions.filter(
    (session) => session.status === 'completed' && isWithinDays(session.date, today, windowDays),
  );
  const weeks = windowDays / 7;
  const perWeek = round(window.length / weeks, 1);

  // Enough history to judge a weekly rate at all.
  const measurable = window.length > 0 || sessions.some((session) => session.status === 'completed');

  const loggedShare =
    window.length === 0
      ? null
      : round(
          window.filter((session) =>
            session.exercises.some((exercise) => exercise.sets.some((set) => set.completed && set.weightKg !== null)),
          ).length / window.length,
          2,
        );

  const sleepValues = checkins
    .filter((entry) => isWithinDays(entry.date, today, windowDays) && entry.sleepHours !== null)
    .map((entry) => entry.sleepHours as number);
  const sleep = sleepValues.length >= 3 ? round(mean(sleepValues), 1) : null;

  const ratioOf = (observed: number | null, required: number) =>
    observed === null || required <= 0 ? null : round(clamp(observed / required, 0, 1.5), 2);

  return [
    {
      id: 'frequency',
      label: 'Sessions a week',
      required: requiredSessions,
      observed: measurable ? perWeek : null,
      unit: '',
      met: measurable ? perWeek >= requiredSessions - 0.5 : null,
      ratio: ratioOf(measurable ? perWeek : null, requiredSessions),
      note: measurable ? `Your last ${windowDays} days` : 'Train once and this starts measuring',
    },
    {
      id: 'logging',
      label: 'Sessions logged',
      required: 1,
      observed: loggedShare,
      unit: '',
      met: loggedShare === null ? null : loggedShare >= 0.8,
      ratio: loggedShare,
      note:
        loggedShare === null
          ? 'Nothing logged yet'
          : 'Weights and reps recorded — without them nothing can be measured',
    },
    {
      id: 'calories',
      label: 'Calories a day',
      required: requiredKcal,
      observed: null,
      unit: 'kcal',
      met: null,
      ratio: null,
      note: 'Not tracked here. The dates assume you hit it.',
    },
    {
      id: 'protein',
      label: 'Protein a day',
      required: requiredProteinG,
      observed: null,
      unit: 'g',
      met: null,
      ratio: null,
      note: 'Not tracked here. Without it the gain is fat, not muscle.',
    },
    {
      id: 'sleep',
      label: 'Sleep',
      required: SLEEP_TARGET_HOURS,
      observed: sleep,
      unit: 'h',
      met: sleep === null ? null : sleep >= SLEEP_TARGET_HOURS - 0.5,
      ratio: ratioOf(sleep, SLEEP_TARGET_HOURS),
      note: sleep === null ? 'From your check-ins or your watch' : `Averaged over ${sleepValues.length} nights`,
    },
  ];
}

/** The share of the measurable commitments being met, 0–1. Null if none are. */
export function complianceOf(commitments: Commitment[]): number | null {
  const measured = commitments.filter((entry) => entry.met !== null);
  if (measured.length === 0) return null;
  return round(measured.filter((entry) => entry.met).length / measured.length, 2);
}
