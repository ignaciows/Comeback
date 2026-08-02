import type { ImageSourcePropType } from 'react-native';

/**
 * The render of each movement: what it looks like, and what it works.
 *
 * A grey anatomy mannequin doing the lift, with the muscles the set is
 * actually for lit in the accent colour and everything else left matte. Not a
 * photo of a person: a photo invites you to compare bodies, and a body is not
 * the information. What you need is where the effort is supposed to land.
 *
 * Static requires, because Metro resolves image assets at build time and a
 * computed path silently yields nothing. An exercise with no entry renders
 * without art rather than crashing — the right failure for decoration.
 *
 * One rule for adding to this: the highlighted muscles have to match
 * `primaryMuscle` and `secondaryMuscles` in `data/exercises`. A render that
 * lights the wrong thing is worse than no render, because people will believe
 * it over the text. The deadlift one generated so far lit the quadriceps, so
 * it is not in here.
 */
export const EXERCISE_ART: Record<string, ImageSourcePropType> = {
  back_squat: require('../../../assets/exercises/back_squat.webp'),
  barbell_bench_press: require('../../../assets/exercises/barbell_bench_press.webp'),
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
};

export function exerciseArt(id: string): ImageSourcePropType | null {
  return EXERCISE_ART[id] ?? EXERCISE_ART[FALLBACK[id] ?? ''] ?? null;
}

/** True when the picture is a stand-in from a related lift, not this one. */
export function isBorrowedArt(id: string): boolean {
  return !EXERCISE_ART[id] && Boolean(FALLBACK[id]);
}
