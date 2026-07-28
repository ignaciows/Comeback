import type { ISODate, PlanSpeed, WorkoutSession } from '@/domain/types';
import { isWithinDays } from '@/utils/date';
import { round } from '@/utils/math';
import type { Commitment } from './commitments';

/**
 * Whether the plan you picked is the plan you are on.
 *
 * Someone can choose the fast route and train twice a week. The honest thing
 * is not to keep printing the fast route's dates — it is to say so, plainly,
 * and offer the plan that matches what they are actually doing. A slower plan
 * being met beats a faster one being missed, every time.
 *
 * It works the other way too. Someone clearing the requirement with recovery
 * to spare is being held back by a number they picked weeks ago, and should be
 * told they can go faster.
 *
 * Two guards keep this from being noise:
 *  · Nothing is judged before three weeks of history. One bad week is a week.
 *  · A downgrade is only offered when the gap is large and persistent, because
 *    telling someone to lower their sights is a serious thing to be wrong about.
 */

export type VerdictState =
  | 'establishing'
  | 'on_track'
  | 'slipping'
  | 'too_demanding'
  | 'ahead';

export type VerdictAction =
  | { kind: 'lower_frequency'; toSessions: number }
  | { kind: 'raise_frequency'; toSessions: number }
  | { kind: 'accelerate'; toSpeed: PlanSpeed }
  | { kind: 'log_more' };

export type PlanVerdict = {
  state: VerdictState;
  /** A few words. */
  headline: string;
  /** One line, always naming the evidence. */
  detail: string;
  /** What the app suggests doing about it. Null when nothing should change. */
  action: VerdictAction | null;
};

export type VerdictInput = {
  today: ISODate;
  sessions: WorkoutSession[];
  commitments: Commitment[];
  /** What this week's ramp step asks for, which may be below the plan's target. */
  currentTarget: number;
  /** The plan's full requirement. */
  requiredSessions: number;
  speed: PlanSpeed;
  /** 0–100. Null until there is enough history. */
  momentum: number | null;
  /** Mean readiness against the user's own baseline, roughly −1 to 1. */
  readinessVsBaseline: number | null;
};

/** Weeks of history before any judgement is passed. */
const MIN_WEEKS = 3;

const FASTER: Record<PlanSpeed, PlanSpeed | null> = {
  cautious: 'steady',
  steady: 'fast',
  fast: 'max',
  max: null,
};

export function judgePlan({
  today,
  sessions,
  commitments,
  currentTarget,
  requiredSessions,
  speed,
  momentum,
  readinessVsBaseline,
}: VerdictInput): PlanVerdict {
  const completed = sessions.filter((session) => session.status === 'completed');
  const recent = completed.filter((session) => isWithinDays(session.date, today, MIN_WEEKS * 7));

  const frequency = commitments.find((entry) => entry.id === 'frequency');
  const logging = commitments.find((entry) => entry.id === 'logging');
  const observed = frequency?.observed ?? null;

  if (completed.length < 4 || recent.length < 2 || observed === null) {
    return {
      state: 'establishing',
      headline: 'Still learning your rhythm',
      detail: `Train a few more sessions and the plan starts checking itself against what you actually do.`,
      action: null,
    };
  }

  // Training but not recording anything: the app is blind, and every number
  // it shows is guesswork. That is worth saying before anything else.
  if (logging?.met === false) {
    return {
      state: 'slipping',
      headline: 'Sessions are not being logged',
      detail:
        'Without weights and reps there is nothing to measure progress from, so the dates below are assumptions.',
      action: { kind: 'log_more' },
    };
  }

  const ratio = round(observed / Math.max(1, currentTarget), 2);

  // Comfortably past what is being asked, recovering well: the ceiling is the
  // plan, not the person.
  const recovering = readinessVsBaseline === null || readinessVsBaseline >= -0.1;
  const strongMomentum = momentum !== null && momentum >= 65;

  if (ratio >= 1 && observed >= requiredSessions && strongMomentum && recovering) {
    const faster = FASTER[speed];
    return {
      state: 'ahead',
      headline: 'You have room to go faster',
      detail: `${observed} sessions a week against ${requiredSessions} asked for, and recovery is holding. A quicker pace is realistic.`,
      action: faster ? { kind: 'accelerate', toSpeed: faster } : null,
    };
  }

  if (ratio >= 0.9) {
    return {
      state: 'on_track',
      headline: 'On plan',
      detail: `${observed} sessions a week against the ${currentTarget} this week asks for.`,
      action: null,
    };
  }

  // A large, sustained gap: the plan is wrong for this life, not the other way
  // round. Offer the frequency actually being hit, rounded down honestly.
  if (ratio < 0.6) {
    const realistic = Math.max(2, Math.floor(observed));
    return {
      state: 'too_demanding',
      headline: 'This plan asks more than you are doing',
      detail: `${observed} sessions a week against ${currentTarget}. A ${realistic}-day plan you actually finish beats a ${currentTarget}-day one you do not.`,
      action: realistic < currentTarget ? { kind: 'lower_frequency', toSessions: realistic } : null,
    };
  }

  return {
    state: 'slipping',
    headline: 'Slightly behind',
    detail: `${observed} sessions a week against ${currentTarget}. Nothing is lost yet — it is the pace that slipped, not the progress.`,
    action: null,
  };
}
