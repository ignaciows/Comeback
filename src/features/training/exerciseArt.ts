import type { ImageSourcePropType } from 'react-native';

/**
 * The render of each movement: what the exercise looks like.
 *
 * A flat blueprint diagram of the movement, drawn in the app's own palette:
 * near-black ground, thin grey outlines, the worked muscles filled in the
 * accent. Not a photo of a person — a photo invites you to compare bodies,
 * and a body is not the information. Not a rendered sculpture either: the
 * rest of the app is flat and 2D, and a marble figure with shadows sitting
 * inside it reads as borrowed from somewhere else.
 *
 * Generated with Recraft in vector mode, which takes the palette as literal
 * hex — `#0A0B0D` ground and `#5BE49B` accent are passed as parameters rather
 * than described in words, so the art cannot drift away from the tokens. It
 * returns real SVG; the assets are rasterised to webp only because the app
 * has no SVG asset pipeline yet.
 *
 * Two things the prompt must always carry. Describing a muscle's location in
 * prose gets that prose drawn into the picture as callout labels, so every
 * prompt forbids text outright. And the flat idiom earns back the muscle
 * highlighting that photorealism could not be trusted with: an approximate
 * green region on a diagram reads as "around here", where the same green on a
 * rendered thigh read as a precise medical claim.
 *
 * That relaxation is narrow, and the reason it is safe is worth keeping. When
 * these were photoreal, highlighting was wrong most of the time — pectorals
 * lit for a lateral raise, quadriceps for a hip thrust, quadriceps again for
 * a deadlift — and a rendered thigh with a glowing muscle is believed over
 * any text beside it. `MuscleMap` remains the authority: it draws from
 * `primaryMuscle` and `secondaryMuscles` and is right by construction, and it
 * is what the exercise screen shows when the question is *which muscles*. The
 * blueprint's green is illustration of the movement, not the source of truth,
 * and it still gets looked at before it ships.
 *
 * Static requires, because Metro resolves image assets at build time and a
 * computed path silently yields nothing. An exercise with no entry renders
 * without art rather than crashing — the right failure for decoration.
 */
export const EXERCISE_ART: Record<string, ImageSourcePropType> = {
  back_squat: require('../../../assets/exercises/back_squat.webp'),
  barbell_bench_press: require('../../../assets/exercises/barbell_bench_press.webp'),
  barbell_row: require('../../../assets/exercises/barbell_row.webp'),
  bulgarian_split_squat: require('../../../assets/exercises/bulgarian_split_squat.webp'),
  deadlift: require('../../../assets/exercises/deadlift.webp'),
  dumbbell_curl: require('../../../assets/exercises/dumbbell_curl.webp'),
  dumbbell_fly: require('../../../assets/exercises/dumbbell_fly.webp'),
  face_pull: require('../../../assets/exercises/face_pull.webp'),
  hanging_leg_raise: require('../../../assets/exercises/hanging_leg_raise.webp'),
  hip_thrust: require('../../../assets/exercises/hip_thrust.webp'),
  lateral_raise: require('../../../assets/exercises/lateral_raise.webp'),
  leg_extension: require('../../../assets/exercises/leg_extension.webp'),
  overhead_press: require('../../../assets/exercises/overhead_press.webp'),
  plank: require('../../../assets/exercises/plank.webp'),
  pull_up: require('../../../assets/exercises/pull_up.webp'),
  rear_delt_fly: require('../../../assets/exercises/rear_delt_fly.webp'),
  seated_leg_curl: require('../../../assets/exercises/seated_leg_curl.webp'),
  triceps_pushdown: require('../../../assets/exercises/triceps_pushdown.webp'),
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
  cable_lateral_raise: 'lateral_raise',
  lying_leg_curl: 'seated_leg_curl',
  walking_lunge: 'bulgarian_split_squat',
  cable_fly: 'dumbbell_fly',
  pec_deck: 'dumbbell_fly',
  overhead_triceps_extension: 'triceps_pushdown',
};

export function exerciseArt(id: string): ImageSourcePropType | null {
  return EXERCISE_ART[id] ?? EXERCISE_ART[FALLBACK[id] ?? ''] ?? null;
}

/** True when the picture is a stand-in from a related lift, not this one. */
export function isBorrowedArt(id: string): boolean {
  return !EXERCISE_ART[id] && Boolean(FALLBACK[id]);
}
