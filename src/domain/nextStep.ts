import type { IconName } from '@/design-system/Icon';
import type {
  BodyMeasurement,
  DailyCheckin,
  Goal,
  Gym,
  ISODate,
  PlannedSession,
  Profile,
  Routine,
  WorkoutSession,
} from '@/domain/types';
import { daysBetween, isWithinDays } from '@/utils/date';

/**
 * The one thing to do next.
 *
 * An app made of rows is only navigable by someone who already knows what is
 * in it. On the first run — and any time something important is missing —
 * there has to be a single obvious place to press, chosen by the app rather
 * than found by the user.
 *
 * Two kinds of step, and the difference matters:
 *
 *  · `setup` — something the app cannot work properly without. These are
 *    finite, they are listed together so the end is visible, and once done
 *    they never come back.
 *  · `today` — the ordinary next action. Always exactly one, never a list,
 *    because a list of things to do today is a list of ways to feel behind.
 *
 * Order is by how much the app is degraded without it. Body weight comes
 * before everything because no projection exists at all without it; a gym
 * comes before a plan because the plan is built from what you can lift.
 */

export type NextStep = {
  id: string;
  kind: 'setup' | 'today';
  /** The button. Three or four words, an imperative. */
  label: string;
  /** One line on why it is worth doing. Never a scold. */
  why: string;
  icon: IconName;
  route: string;
  /** Lower runs first. */
  priority: number;
};

export type NextStepInput = {
  today: ISODate;
  profile: Profile | null;
  goal: Goal | null;
  gyms: Gym[];
  routines: Routine[];
  measurements: BodyMeasurement[];
  checkins: DailyCheckin[];
  sessions: WorkoutSession[];
  plannedSessions: PlannedSession[];
  /** Whether a multi-block plan is being followed. */
  hasRoute: boolean;
  /** Whether the one-off starting-strength assessment has been done. */
  hasAssessment: boolean;
  activeSessionId: string | null;
};

export function deriveSetupSteps(input: NextStepInput): NextStep[] {
  const steps: NextStep[] = [];

  if (input.measurements.length === 0) {
    steps.push({
      id: 'weight',
      kind: 'setup',
      label: 'Log your weight',
      why: 'Every date and calorie number is worked out from it.',
      icon: 'body',
      route: '/log-weight',
      priority: 1,
    });
  }

  if (input.gyms.length === 0) {
    steps.push({
      id: 'gym',
      kind: 'setup',
      label: 'Find your gym',
      why: 'So the plan only asks for equipment you actually have.',
      icon: 'gym',
      route: '/gyms',
      priority: 2,
    });
  }

  if (!input.hasRoute) {
    steps.push({
      id: 'plan',
      kind: 'setup',
      label: 'Choose your plan',
      why: 'Build first or lean out first — the shape of the next few months.',
      icon: 'target',
      route: '/routes',
      priority: 3,
    });
  }

  // After the gym, because it needs equipment, and before muscle focus,
  // because knowing what you lift matters more than which muscle you favour.
  if (!input.hasAssessment && input.gyms.length > 0) {
    steps.push({
      id: 'assessment',
      kind: 'setup',
      label: 'Measure your starting strength',
      why: 'One session of test sets, so the weights it gives you are yours and not a guess.',
      icon: 'target',
      route: '/assessment',
      priority: 4,
    });
  }

  if (input.goal && (input.goal.muscleFocus?.length ?? 0) === 0 && input.routines.length > 0) {
    steps.push({
      id: 'focus',
      kind: 'setup',
      label: 'Pick your muscles',
      why: 'Optional. Tap what you want to grow and the routine follows.',
      icon: 'body',
      route: '/focus',
      priority: 4,
    });
  }

  return steps.sort((a, b) => a.priority - b.priority);
}

/**
 * The single ordinary action for right now.
 *
 * Setup steps outrank it: there is no point recommending today's session to
 * someone whose plan cannot be computed yet.
 */
export function deriveTodayStep(input: NextStepInput): NextStep | null {
  const setup = deriveSetupSteps(input);
  if (setup.length > 0) return setup[0];

  if (input.activeSessionId) {
    return {
      id: 'resume',
      kind: 'today',
      label: 'Back to your session',
      why: 'It is still running.',
      icon: 'play',
      route: '/session',
      priority: 0,
    };
  }

  const trainedToday = input.sessions.some(
    (session) => session.status === 'completed' && session.date === input.today,
  );
  const plannedToday = input.plannedSessions.find(
    (entry) => entry.date === input.today && entry.status === 'planned',
  );

  if (plannedToday && !trainedToday) {
    return {
      id: 'train',
      kind: 'today',
      label: 'Start today’s session',
      why: 'It is laid out and waiting.',
      icon: 'train',
      route: '/session',
      priority: 10,
    };
  }

  const checkedIn = input.checkins.some((entry) => entry.date === input.today);
  if (!checkedIn && !trainedToday) {
    return {
      id: 'checkin',
      kind: 'today',
      label: 'Twenty-second check-in',
      why: 'How you slept decides how hard today should be.',
      icon: 'sleep',
      route: '/checkin',
      priority: 20,
    };
  }

  // Weighing in weekly is enough to keep the projection honest.
  const lastWeight = [...input.measurements].sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  if (lastWeight && daysBetween(lastWeight.date, input.today) >= 7) {
    return {
      id: 'weigh_in',
      kind: 'today',
      label: 'Log your weight',
      why: 'A week without it and the dates start drifting.',
      icon: 'body',
      route: '/log-weight',
      priority: 30,
    };
  }

  if (trainedToday) {
    return {
      id: 'done',
      kind: 'today',
      label: 'See where that put you',
      why: 'Today is logged.',
      icon: 'progress',
      route: '/progress',
      priority: 40,
    };
  }

  // A rest day is a legitimate answer, not an empty state.
  const trainedThisWeek = input.sessions.filter(
    (session) => session.status === 'completed' && isWithinDays(session.date, input.today, 7),
  ).length;

  return {
    id: 'rest',
    kind: 'today',
    label: 'Look at your plan',
    why: trainedThisWeek > 0 ? 'Nothing scheduled today. Rest counts.' : 'Nothing scheduled today.',
    icon: 'target',
    route: '/plan',
    priority: 50,
  };
}

/** How much of the one-time setup is behind you, 0–1. */
export function setupProgress(input: NextStepInput): number {
  // Muscle focus is optional, so it is not part of the denominator.
  const required = [
    input.measurements.length > 0,
    input.gyms.length > 0,
    input.hasRoute,
    input.routines.length > 0,
  ];
  return required.filter(Boolean).length / required.length;
}
