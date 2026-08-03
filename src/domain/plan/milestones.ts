import type { ISODate } from '@/domain/types';
import { addDays, daysBetween } from '@/utils/date';
import { clamp } from '@/utils/math';

/**
 * The three dates that matter, in the order a person cares about them.
 *
 * The plan screen led with "days to your target", which for a realistic plan
 * is a number somewhere past two hundred. That is the truth and it is also
 * the least motivating true thing available, because nobody gets out of bed
 * for a date in September. What people actually want to know in week two is
 * *when does this start showing*, and that has a real answer.
 *
 * So three, largest first: when you start seeing it, when this phase ends,
 * when the plan ends. The first is the headline because it is the one that
 * arrives soon enough to be worth waiting for.
 *
 * Every one of them moves with adherence. Training two of four planned
 * sessions does not get you there on the same date as training four, and a
 * countdown that ignores that is a countdown that lies pleasantly for six
 * weeks and then stops being believed at all.
 *
 * Sources:
 *  · Strength climbs before muscle does — the first three to four weeks of
 *    gains are almost entirely neural. Moritani & deVries (1979).
 *  · Muscle thickness measured in the first three weeks is mostly swelling
 *    and damage rather than new tissue; real hypertrophy drives the change
 *    from roughly week three onward. Damas et al. (2016).
 *  · Visible change in the mirror at around eight to ten weeks of consistent
 *    training; Seynnes et al. (2007) find measurable growth from ~3 weeks,
 *    which is well before it is visible to the naked eye.
 *  · Losing fat shows up on a different clock — it tracks how much is gone,
 *    not how long you have trained, and about 4 % of body weight is where
 *    people start seeing it in the mirror.
 */

/** Strength responds first, and it is the first thing you can feel. */
const FEEL_WEEKS = 3;

/** Consistent training before hypertrophy is visible rather than measurable. */
const SEE_WEEKS_BUILDING = 9;

/** Share of body weight lost that reads as a visible change when cutting. */
const VISIBLE_LOSS_SHARE = 0.04;

/**
 * The worst adherence the estimate will model.
 *
 * Below this the honest answer stops being a date and starts being "not at
 * this rate", and stretching the countdown to two years instead of saying so
 * would be a worse lie than the optimistic version it replaced.
 */
const MIN_MODELLED_ADHERENCE = 0.4;

export type MilestoneKey = 'see' | 'phase' | 'plan';

export type Milestone = {
  key: MilestoneKey;
  label: string;
  /** Days from today. Null when there is nothing to count towards. */
  days: number | null;
  date: ISODate | null;
  /** One line: what actually happens on that date. */
  detail: string;
};

export type MilestoneInput = {
  today: ISODate;
  /** When the current goal started — the clock the results milestone runs on. */
  goalStartedAt: ISODate;
  /** Share of planned sessions actually trained, 0–1. */
  adherence: number;
  /** Negative when losing weight. Drives which results clock applies. */
  weeklyRateKg: number;
  currentWeightKg: number;
  /** End of the phase you are in now, when the plan has phases. */
  phaseEndsOn: ISODate | null;
  phaseLabel: string | null;
  /** End of the whole plan. */
  planEndsOn: ISODate | null;
};

/** Calendar weeks it really takes, given how often the sessions happen. */
function stretched(weeks: number, adherence: number): number {
  return weeks / clamp(adherence, MIN_MODELLED_ADHERENCE, 1);
}

/**
 * Weeks from the start of the goal until the change is visible.
 *
 * Building runs on a training clock: enough consistent weeks for new tissue
 * rather than swelling. Cutting runs on a scale clock: visible when enough is
 * gone, which at a slow rate can take longer than the hypertrophy timeline
 * and at a fast one is quicker.
 */
export function weeksToVisible(input: {
  adherence: number;
  weeklyRateKg: number;
  currentWeightKg: number;
}): number {
  if (input.weeklyRateKg < -0.05 && input.currentWeightKg > 0) {
    const kgNeeded = input.currentWeightKg * VISIBLE_LOSS_SHARE;
    const weeks = kgNeeded / Math.abs(input.weeklyRateKg);
    // Still capped by the training clock at the fast end: dropping four per
    // cent in a fortnight is water, and it does not look like a new body.
    return Math.max(4, stretched(weeks, input.adherence));
  }
  return stretched(SEE_WEEKS_BUILDING, input.adherence);
}

/** The strength milestone, for the line under the headline. */
export function weeksToFeel(adherence: number): number {
  return stretched(FEEL_WEEKS, adherence);
}

function daysUntil(today: ISODate, date: ISODate | null): number | null {
  if (!date) return null;
  return Math.max(0, daysBetween(today, date));
}

export function planMilestones(input: MilestoneInput): Milestone[] {
  const trainedDays = Math.max(0, daysBetween(input.goalStartedAt, input.today));
  const visibleDay = Math.round(
    weeksToVisible({
      adherence: input.adherence,
      weeklyRateKg: input.weeklyRateKg,
      currentWeightKg: input.currentWeightKg,
    }) * 7,
  );

  // Counted from when the goal started, not from today: six weeks in, you are
  // six weeks closer, and restarting the count every time the app opens is how
  // a countdown stops meaning anything.
  const seeDays = Math.max(0, visibleDay - trainedDays);
  const losing = input.weeklyRateKg < -0.05;

  const see: Milestone = {
    key: 'see',
    label: 'Days to start seeing it',
    days: seeDays,
    date: addDays(input.today, seeDays),
    detail:
      seeDays === 0
        ? 'You are past the point where this shows. Compare a photo with your first week.'
        : losing
          ? `About ${Math.round(input.currentWeightKg * VISIBLE_LOSS_SHARE)} kg down is where it starts showing in the mirror.`
          : 'Roughly nine weeks of consistent training before new muscle is visible rather than just measurable.',
  };

  const phaseDays = daysUntil(input.today, input.phaseEndsOn);
  const phase: Milestone = {
    key: 'phase',
    label: input.phaseLabel ? `Days left in ${input.phaseLabel.toLowerCase()}` : 'Days left in this phase',
    days: phaseDays,
    date: input.phaseEndsOn,
    detail: phaseDays === null ? 'No phases in this plan.' : 'Then what you eat and how you train changes.',
  };

  const planDays = daysUntil(input.today, input.planEndsOn);
  const plan: Milestone = {
    key: 'plan',
    label: 'Days to finish the plan',
    days: planDays,
    date: input.planEndsOn,
    detail: planDays === null ? 'Set a target and this counts down to it.' : 'The whole route, start to finish.',
  };

  return [see, phase, plan];
}

/** The line under the headline: what arrives before you can see anything. */
export function feelLine(input: { today: ISODate; goalStartedAt: ISODate; adherence: number }): string {
  const trainedDays = Math.max(0, daysBetween(input.goalStartedAt, input.today));
  const feelDays = Math.max(0, Math.round(weeksToFeel(input.adherence) * 7) - trainedDays);

  if (feelDays === 0) {
    return 'Your lifts are already climbing — that comes first, before anything shows.';
  }
  return `Strength moves first: about ${feelDays} days until the weights start going up.`;
}
