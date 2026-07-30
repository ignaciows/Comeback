import { getExercise } from '@/data/exercises';
import type { ExperienceLevel, MovementPattern } from '@/domain/types';
import { clamp, round } from '@/utils/math';

/**
 * Finding out what someone can actually lift, before prescribing anything.
 *
 * Until this exists the app is guessing. It knows your height, your weight and
 * what you want, and from that it writes a plan that has no idea whether your
 * bench is forty kilos or a hundred — so the first two weeks are spent
 * discovering that by trial and error, which is the least pleasant possible
 * way to start.
 *
 * One session fixes it. Not a one-rep max: testing a true maximum on someone
 * coming back from a layoff is how people get hurt in week one, and the number
 * is not worth the risk. Instead a **rep-out at a manageable weight** — pick
 * something you could do about ten times, do as many clean reps as you can, and
 * the maximum is estimated from that. The estimate is good to within a few
 * percent in the rep ranges that matter, which is far more precision than a
 * starting weight needs.
 *
 * Everything the estimate produces is then deliberately *under*-prescribed.
 * Starting too light costs one session; starting too heavy costs a form
 * breakdown, a bad first impression, and sometimes a shoulder.
 */

export type RepOut = {
  exerciseId: string;
  weightKg: number;
  /** Clean reps completed. */
  reps: number;
};

/**
 * Estimated one-rep max from a set taken close to failure.
 *
 * Epley averaged with Brzycki: the two disagree in opposite directions as reps
 * climb, so the mean is steadier than either. Both are only honest up to about
 * a dozen reps — past that the relationship falls apart and the number becomes
 * fiction, so it returns null rather than a confident wrong answer.
 */
export const MAX_RELIABLE_REPS = 12;

export function estimateOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps < 1 || reps > MAX_RELIABLE_REPS) return null;
  if (reps === 1) return round(weightKg, 1);

  const epley = weightKg * (1 + reps / 30);
  const brzycki = weightKg * (36 / (37 - reps));

  return round((epley + brzycki) / 2, 1);
}

/** The share of a one-rep max that a given rep target usually corresponds to. */
const INTENSITY: Record<number, number> = {
  1: 1.0,
  2: 0.96,
  3: 0.93,
  4: 0.9,
  5: 0.87,
  6: 0.85,
  7: 0.82,
  8: 0.8,
  9: 0.77,
  10: 0.75,
  11: 0.72,
  12: 0.7,
  15: 0.65,
};

function intensityFor(reps: number): number {
  const known = INTENSITY[reps];
  if (known !== undefined) return known;
  // Between the table's rungs, and never outside what it covers.
  return clamp(1 - 0.025 * (reps - 1), 0.6, 1);
}

/**
 * How much of the estimate to actually prescribe on day one.
 *
 * Never the full amount. Someone returning after months off has connective
 * tissue and technique that lag well behind what their muscles can move, and
 * the rep-out itself was one set on one day. The plan can add load quickly —
 * it does that every session — so the cost of starting low is a week, and the
 * cost of starting high is an injury.
 */
const FIRST_SESSION_DISCOUNT: Record<ExperienceLevel, number> = {
  beginner: 0.8,
  returning: 0.85,
  intermediate: 0.9,
  advanced: 0.92,
};

export type StartingLoad = {
  exerciseId: string;
  oneRepMaxKg: number;
  /** What to put on the bar for the first working set. */
  weightKg: number;
  reps: number;
  /** Why this number, in the user's terms. */
  reason: string;
};

export function startingLoad(
  repOut: RepOut,
  repTarget: number,
  experience: ExperienceLevel,
  layoffWeeks: number,
): StartingLoad | null {
  const oneRepMax = estimateOneRepMax(repOut.weightKg, repOut.reps);
  if (oneRepMax === null) return null;

  const exercise = getExercise(repOut.exerciseId);
  const step = exercise?.equipment.includes('dumbbell') ? 2 : 2.5;

  // A long layoff discounts further: the estimate is about muscle, and the
  // parts that complain first are the ones that detrain fastest.
  const layoffPenalty = clamp(1 - layoffWeeks * 0.004, 0.85, 1);
  const target = oneRepMax * intensityFor(repTarget) * FIRST_SESSION_DISCOUNT[experience] * layoffPenalty;

  const weightKg = Math.max(step, Math.round(target / step) * step);

  return {
    exerciseId: repOut.exerciseId,
    oneRepMaxKg: oneRepMax,
    weightKg: round(weightKg, 1),
    reps: repTarget,
    reason: `From ${repOut.reps} reps at ${repOut.weightKg} kg — an estimated max of about ${Math.round(
      oneRepMax,
    )} kg.`,
  };
}

export type AssessmentItem = {
  exerciseId: string;
  pattern: MovementPattern;
  /** What to tell someone before they start the set. */
  instruction: string;
};

/**
 * What to test, and nothing more.
 *
 * One movement per major pattern: everything else in the routine is a
 * variation of these, and a starting load for a press transfers to every other
 * press far better than a fifth test set would improve the estimate. Five sets
 * total — an assessment nobody finishes tells you nothing.
 */
export const ASSESSMENT: AssessmentItem[] = [
  {
    exerciseId: 'barbell_bench_press',
    pattern: 'horizontal_push',
    instruction: 'Pick a weight you could press about ten times. Stop while every rep still looks the same.',
  },
  {
    exerciseId: 'lat_pulldown',
    pattern: 'vertical_pull',
    instruction: 'Something you could pull about ten times. Full stretch at the top, no swinging.',
  },
  {
    exerciseId: 'leg_press',
    pattern: 'squat',
    instruction: 'A weight you could press about ten times. Stop before the low back rounds off the pad.',
  },
  {
    exerciseId: 'overhead_press',
    pattern: 'vertical_push',
    instruction: 'Light to start — the shoulder is the joint that complains first after a break.',
  },
  {
    exerciseId: 'seated_cable_row',
    pattern: 'horizontal_pull',
    instruction: 'About ten. Sit tall and let the back do it, not the lower back.',
  },
];

export type AssessmentOutcome = {
  loads: StartingLoad[];
  /** Patterns covered, so the plan knows what it can prescribe confidently. */
  covered: MovementPattern[];
  /** Shown once at the end: what this changed. */
  summary: string;
};

export function summarise(
  results: RepOut[],
  repTarget: number,
  experience: ExperienceLevel,
  layoffWeeks: number,
): AssessmentOutcome {
  const loads = results
    .map((result) => startingLoad(result, repTarget, experience, layoffWeeks))
    .filter((load): load is StartingLoad => load !== null);

  const covered = loads
    .map((load) => ASSESSMENT.find((item) => item.exerciseId === load.exerciseId)?.pattern)
    .filter((pattern): pattern is MovementPattern => pattern !== undefined);

  return {
    loads,
    covered,
    summary:
      loads.length === 0
        ? 'Nothing recorded, so the plan keeps its own estimates for now.'
        : `${loads.length} movement${loads.length === 1 ? '' : 's'} measured. Your first sessions start from these numbers instead of a guess, and go up from there.`,
  };
}
