import { getExercise } from '@/data/exercises';
import type { BiologicalSex, MuscleGroup } from '@/domain/types';
import { round } from '@/utils/math';

/**
 * Which parts of you are strong, and which are holding the rest back.
 *
 * The app already measures strength lift by lift. What it could not say is the
 * thing people actually want to know: *where am I weak*. A bench of 90 kg and
 * a press of 40 kg are two numbers until you know that one of them is behind
 * the other, and then they are an instruction.
 *
 * Two ideas do the work here, and they are not the same idea:
 *
 *  1. **Normalising.** A kilo of bench and a kilo of press are not comparable,
 *     so every lift is divided by what that lift usually is at a given body
 *     weight. What comes out is a number where 1.0 means "ordinary for a
 *     trained lifter" on *that movement*, and those numbers are comparable
 *     across movements. Muscles are ranked on that.
 *
 *  2. **Ratios.** The absolute standards carry real error — they vary by
 *     limb length, by sex, by whose dataset you read. The *ratios between
 *     your own lifts* do not: they are you against you, and they are where
 *     the reliable finding lives. A press at half your bench says something
 *     true about your shoulders whatever the population numbers say, which is
 *     why an imbalance is only ever reported from a ratio.
 *
 * Nothing here is a percentile and nothing here is a diagnosis. It is an
 * estimate from an estimated one-rep max, and it is labelled as one.
 *
 * Sources:
 *  · One-rep max from a submaximal set: Epley and Brzycki, averaged. See
 *    `assessment.ts`, which is where the estimate comes from.
 *  · Body-weight strength standards: the widely used ExRx / Strength Level
 *    bands, taken at the "intermediate" rung — a couple of years of regular
 *    training, not a competitive lifter.
 *  · Balance ratios: press ≈ 0.6× bench, bench ≈ 0.75× squat, squat ≈ 0.8×
 *    deadlift, row ≈ bench. Long-standing coaching benchmarks rather than
 *    trial results, which is why they are bands rather than numbers.
 */

/**
 * What each lift usually is, as a multiple of body weight, for someone with a
 * couple of years of training behind them.
 *
 * Machines carry the widest error — a leg press varies by more than a person
 * does, depending on the sled angle — so they are marked `loose` and never
 * used on their own to call something weak.
 */
type Standard = { male: number; female: number; loose?: boolean };

const STANDARDS: Record<string, Standard> = {
  barbell_bench_press: { male: 1.25, female: 0.7 },
  dumbbell_bench_press: { male: 1.1, female: 0.62 },
  incline_dumbbell_press: { male: 0.95, female: 0.55 },
  chest_press_machine: { male: 1.15, female: 0.68, loose: true },
  overhead_press: { male: 0.8, female: 0.45 },
  dumbbell_shoulder_press: { male: 0.7, female: 0.4 },
  shoulder_press_machine: { male: 0.8, female: 0.48, loose: true },
  back_squat: { male: 1.75, female: 1.3 },
  front_squat: { male: 1.4, female: 1.05 },
  goblet_squat: { male: 0.8, female: 0.6 },
  hack_squat: { male: 2.1, female: 1.55, loose: true },
  leg_press: { male: 2.7, female: 2.0, loose: true },
  deadlift: { male: 2.0, female: 1.5 },
  romanian_deadlift: { male: 1.6, female: 1.2 },
  barbell_row: { male: 1.15, female: 0.7 },
  seated_cable_row: { male: 1.1, female: 0.68, loose: true },
  lat_pulldown: { male: 1.05, female: 0.65, loose: true },
  pull_up: { male: 1.3, female: 0.95 },
  barbell_curl: { male: 0.55, female: 0.3 },
  dumbbell_curl: { male: 0.28, female: 0.16 },
  cable_curl: { male: 0.5, female: 0.28, loose: true },
};

/**
 * The share of a lift's score that reaches a muscle it only assists.
 *
 * Half, because a secondary muscle is genuinely loaded by the lift but is not
 * what limits it — a bench press tells you much more about a chest than about
 * the triceps that happen to be in the way.
 */
const SECONDARY_WEIGHT = 0.5;

/** Below this, a lift is not doing the job the standards assume it does. */
const MIN_CONFIDENT_LIFTS = 2;

export type LiftMax = {
  exerciseId: string;
  /** Estimated one-rep max in kg. */
  oneRepMaxKg: number;
  /** When it was measured. Used only to say how stale the ranking is. */
  measuredOn?: string;
};

export type MuscleScore = {
  muscle: MuscleGroup;
  /**
   * Your lifts on this muscle against what those lifts usually are. 1.0 is
   * ordinary for a trained lifter; it is not a percentile.
   */
  relative: number;
  /** Which lifts fed it, best evidence first. */
  from: string[];
  /**
   * How much to trust it. Machine-only evidence, or a single lift, is `low`.
   */
  confidence: 'low' | 'medium' | 'high';
};

export type Imbalance = {
  /** The muscle that is behind. */
  lagging: MuscleGroup;
  /** What it is behind relative to. */
  reference: MuscleGroup;
  /** The two lifts the finding came from. */
  liftIds: [string, string];
  /** Your ratio, and what it usually is. */
  ratio: number;
  expected: number;
  /** What this means and what to do, in one sentence each. */
  finding: string;
  action: string;
};

export type MuscleRanking = {
  scores: MuscleScore[];
  /** Strongest first. */
  strongest: MuscleScore[];
  /** Weakest first. */
  weakest: MuscleScore[];
  imbalances: Imbalance[];
  /** True when there is too little to say anything worth saying. */
  thin: boolean;
};

export type RankingInput = {
  lifts: LiftMax[];
  bodyWeightKg: number;
  sex: BiologicalSex;
};

function standardFor(exerciseId: string, sex: BiologicalSex): Standard | null {
  const standard = STANDARDS[exerciseId];
  if (!standard) return null;
  // With sex unset, the midpoint. Assuming one would make every number for
  // half the users quietly wrong in the same direction.
  if (sex === 'unspecified') return { ...standard, male: (standard.male + standard.female) / 2 };
  return standard;
}

function multipleFor(standard: Standard, sex: BiologicalSex): number {
  return sex === 'female' ? standard.female : standard.male;
}

/**
 * Each lift as a fraction of what that lift usually is.
 *
 * This is the step that makes a press and a squat comparable at all, and it is
 * why the ranking can say "your shoulders are behind your legs" rather than
 * the useless truth that you squat more than you press.
 */
export function relativeStrength(
  lift: LiftMax,
  bodyWeightKg: number,
  sex: BiologicalSex,
): { relative: number; loose: boolean } | null {
  const standard = standardFor(lift.exerciseId, sex);
  if (!standard || bodyWeightKg <= 0 || lift.oneRepMaxKg <= 0) return null;

  const expected = multipleFor(standard, sex) * bodyWeightKg;
  return { relative: round(lift.oneRepMaxKg / expected, 3), loose: standard.loose === true };
}

/**
 * Ratios between lifts, and what each one means when it is off.
 *
 * `expected` is the middle of the usual band and `tolerance` is how far under
 * it has to fall before it is worth saying. The tolerances are wide on
 * purpose: telling someone their shoulders are weak on a 5 % difference would
 * be reading noise back to them as a diagnosis.
 */
const RATIOS: {
  lagging: MuscleGroup;
  reference: MuscleGroup;
  of: string[];
  to: string[];
  expected: number;
  tolerance: number;
  finding: string;
  action: string;
}[] = [
  {
    lagging: 'shoulders',
    reference: 'chest',
    of: ['overhead_press', 'dumbbell_shoulder_press', 'shoulder_press_machine'],
    to: ['barbell_bench_press', 'dumbbell_bench_press', 'chest_press_machine'],
    expected: 0.6,
    tolerance: 0.12,
    finding: 'Your press is a long way behind your bench, which usually means the shoulders are being carried by the chest.',
    action: 'Press overhead first in the session, while you are fresh, for a block.',
  },
  {
    lagging: 'back',
    reference: 'chest',
    of: ['barbell_row', 'seated_cable_row', 'lat_pulldown', 'pull_up'],
    to: ['barbell_bench_press', 'dumbbell_bench_press', 'chest_press_machine'],
    expected: 0.9,
    tolerance: 0.15,
    finding: 'You push considerably more than you pull. Over time that pulls the shoulders forward and it is where press injuries start.',
    action: 'Add a set of rows for every set of pressing until they meet.',
  },
  {
    lagging: 'hamstrings',
    reference: 'quads',
    of: ['deadlift', 'romanian_deadlift'],
    to: ['back_squat', 'front_squat'],
    expected: 1.15,
    tolerance: 0.2,
    finding: 'Your hinge is behind your squat, so the back of your legs is doing less than the front.',
    action: 'Put Romanian deadlifts or hip thrusts in twice a week.',
  },
  {
    lagging: 'quads',
    reference: 'chest',
    of: ['back_squat', 'front_squat'],
    to: ['barbell_bench_press', 'dumbbell_bench_press'],
    expected: 1.35,
    tolerance: 0.25,
    finding: 'Your legs are behind your upper body by more than the usual gap.',
    action: 'Squat or leg press first in the week, before the pressing takes the energy.',
  },
];

/** The best available max for any of a set of exercises. */
function bestOf(lifts: LiftMax[], ids: string[]): LiftMax | null {
  const found = lifts.filter((lift) => ids.includes(lift.exerciseId));
  if (found.length === 0) return null;
  // Ordered by the list, so a barbell lift beats a machine standing in for it.
  for (const id of ids) {
    const match = found.find((lift) => lift.exerciseId === id);
    if (match) return match;
  }
  return found[0];
}

export function rankMuscles({ lifts, bodyWeightKg, sex }: RankingInput): MuscleRanking {
  const buckets = new Map<MuscleGroup, { total: number; weight: number; from: string[]; loose: boolean }>();

  for (const lift of lifts) {
    const scored = relativeStrength(lift, bodyWeightKg, sex);
    const exercise = getExercise(lift.exerciseId);
    if (!scored || !exercise) continue;

    const contribute = (muscle: MuscleGroup, weight: number) => {
      const bucket = buckets.get(muscle) ?? { total: 0, weight: 0, from: [], loose: true };
      bucket.total += scored.relative * weight;
      bucket.weight += weight;
      if (weight === 1) bucket.from.push(lift.exerciseId);
      // One barbell lift is enough to stop the whole muscle being loose.
      if (!scored.loose) bucket.loose = false;
      buckets.set(muscle, bucket);
    };

    contribute(exercise.primaryMuscle, 1);
    for (const muscle of exercise.secondaryMuscles) contribute(muscle, SECONDARY_WEIGHT);
  }

  const scores: MuscleScore[] = [...buckets.entries()]
    .filter(([, bucket]) => bucket.weight > 0)
    .map(([muscle, bucket]) => ({
      muscle,
      relative: round(bucket.total / bucket.weight, 2),
      from: bucket.from,
      confidence: bucket.from.length === 0 || bucket.loose ? 'low' : bucket.from.length > 1 ? 'high' : 'medium',
    }));

  const byStrength = [...scores].sort((a, b) => b.relative - a.relative);

  const imbalances: Imbalance[] = [];
  for (const rule of RATIOS) {
    const lagging = bestOf(lifts, rule.of);
    const reference = bestOf(lifts, rule.to);
    if (!lagging || !reference || reference.oneRepMaxKg <= 0) continue;

    const ratio = lagging.oneRepMaxKg / reference.oneRepMaxKg;
    if (ratio >= rule.expected - rule.tolerance) continue;

    imbalances.push({
      lagging: rule.lagging,
      reference: rule.reference,
      liftIds: [lagging.exerciseId, reference.exerciseId],
      ratio: round(ratio, 2),
      expected: rule.expected,
      finding: rule.finding,
      action: rule.action,
    });
  }

  // Worst gap first: the one finding worth acting on is the biggest one.
  imbalances.sort((a, b) => a.ratio / a.expected - b.ratio / b.expected);

  return {
    scores,
    strongest: byStrength,
    weakest: [...byStrength].reverse(),
    imbalances,
    thin: lifts.filter((lift) => STANDARDS[lift.exerciseId]).length < MIN_CONFIDENT_LIFTS,
  };
}

/**
 * The one sentence to lead with.
 *
 * An imbalance beats a ranking every time: "your shoulders are behind your
 * chest" is something to do on Monday, and "your back scores 1.12" is trivia.
 */
export function rankingHeadline(ranking: MuscleRanking): string {
  if (ranking.thin) return 'Test a couple more lifts and this can tell you where you are weak.';
  if (ranking.imbalances.length > 0) return ranking.imbalances[0].finding;

  const best = ranking.strongest[0];
  const worst = ranking.weakest[0];
  if (!best || !worst || best.muscle === worst.muscle) return 'Nothing is obviously out of step.';
  return `Nothing is badly out of step. Your ${best.muscle} lead and your ${worst.muscle} trail, by a normal margin.`;
}
