import type { ImageSourcePropType } from 'react-native';

/**
 * The render of each movement: what the exercise looks like.
 *
 * A grey mannequin performing the lift. Not a photo of a person — a photo
 * invites you to compare bodies, and a body is not the information. What you
 * need is the shape of the movement.
 *
 * **The render does not say which muscles are worked, and must not.** That job
 * belongs to `MuscleMap`, which draws its highlight straight from
 * `primaryMuscle` and `secondaryMuscles` and is therefore right by
 * construction. The two used to sit on the same screen both answering that
 * question — one from data, one from a generative model — which is two sources
 * of truth for one fact, and the stochastic one was wrong often enough to
 * matter. Over ten generated renders it lit the pectorals for a lateral raise,
 * the quadriceps for a hip thrust, and the quadriceps again for a deadlift. A
 * diagram that highlights the wrong muscle is worse than no diagram, because
 * people believe the picture over the text.
 *
 * So: the picture shows the movement, the map shows the muscles. It also makes
 * the pictures far cheaper to get right — with no anatomy being asserted, the
 * worst a bad render can do is show a plank on the hands instead of the
 * forearms, which is a cosmetic miss rather than a false claim about a body.
 *
 * Static requires, because Metro resolves image assets at build time and a
 * computed path silently yields nothing. An exercise with no entry renders
 * without art rather than crashing — the right failure for decoration.
 */
export const EXERCISE_ART: Record<string, ImageSourcePropType> = {
  back_squat: require('../../../assets/exercises/back_squat.webp'),
  barbell_bench_press: require('../../../assets/exercises/barbell_bench_press.webp'),
  barbell_row: require('../../../assets/exercises/barbell_row.webp'),
  deadlift: require('../../../assets/exercises/deadlift.webp'),
  dumbbell_curl: require('../../../assets/exercises/dumbbell_curl.webp'),
  overhead_press: require('../../../assets/exercises/overhead_press.webp'),
  pull_up: require('../../../assets/exercises/pull_up.webp'),
};

/**
 * The render for an exercise, falling back to a movement it is a variation of.
 *
 * A dumbbell bench press is close enough to a barbell bench press for the
 * picture to still teach the right thing, and one render covering a family
 * beats five exercises with nothing at all.
 */
const FALLBACK: Record<string, string> = {
  dumbbell_bench_press: 'barbell_bench_press',
  incline_dumbbell_press: 'barbell_bench_press',
  chest_press_machine: 'barbell_bench_press',
  push_up: 'barbell_bench_press',
  front_squat: 'back_squat',
  goblet_squat: 'back_squat',
  hack_squat: 'back_squat',
  leg_press: 'back_squat',
  dumbbell_shoulder_press: 'overhead_press',
  shoulder_press_machine: 'overhead_press',
  assisted_pull_up: 'pull_up',
  lat_pulldown: 'pull_up',
  barbell_curl: 'dumbbell_curl',
  cable_curl: 'dumbbell_curl',
  dumbbell_row: 'barbell_row',
  seated_cable_row: 'barbell_row',
  chest_supported_row: 'barbell_row',
  romanian_deadlift: 'deadlift',
  trap_bar_deadlift: 'deadlift',
};

export function exerciseArt(id: string): ImageSourcePropType | null {
  return EXERCISE_ART[id] ?? EXERCISE_ART[FALLBACK[id] ?? ''] ?? null;
}

/** True when the picture is a stand-in from a related lift, not this one. */
export function isBorrowedArt(id: string): boolean {
  return !EXERCISE_ART[id] && Boolean(FALLBACK[id]);
}
