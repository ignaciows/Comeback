import { EXERCISES, getExercise } from '@/data/exercises';
import type { MuscleGroup } from '@/domain/types';

/**
 * How much of a lift each muscle actually does, on a 0–1 scale.
 *
 * "Primary and secondary" is too blunt to draw. An incline press and a flat
 * press have the same two labels and are not the same exercise: one puts
 * noticeably more on the front delt and less on the lower chest, and someone
 * choosing between them deserves to see that rather than two identical
 * diagrams. The same is true of every close variant in the library — chin-up
 * versus pull-up, Romanian versus conventional deadlift, goblet versus back
 * squat.
 *
 * So the map is weighted, and the anatomy drawing lights each muscle in
 * proportion. 1.0 is "this is what the exercise is"; around 0.5 is "a real
 * contributor you will feel"; 0.2 is "involved, but you would not train it
 * this way".
 *
 * ## Where the numbers come from
 *
 * These are not measurements. Surface EMG can rank muscles within one
 * exercise but does not convert cleanly into a share of the work, and no
 * published table gives a per-muscle fraction for fifty-one gym movements.
 * What they are is a consistent reading of the biomechanics — which joints
 * move, through what range, against what moment arm — applied the same way
 * everywhere, and calibrated against the EMG comparisons that do exist
 * (Schoenfeld's and Contreras' exercise-comparison work on squat, hip thrust,
 * row and press variants).
 *
 * They are stated as approximate on purpose. The value of the drawing is the
 * *ordering* — that a lateral raise is nearly all side delt, that a dip is
 * chest and triceps in similar measure — not the second decimal place.
 */

export type MuscleWeights = Partial<Record<MuscleGroup, number>>;

/**
 * The fallback, when an exercise has no hand-tuned entry.
 *
 * Derived from the library's own primary/secondary labels so a new exercise
 * always draws something sensible, and so the two can never disagree about
 * which muscle is the point of the movement.
 */
const PRIMARY_WEIGHT = 1;
const SECONDARY_WEIGHT = 0.45;

/**
 * Hand-tuned splits, for the movements where the label pair hides the thing
 * worth knowing. Anything absent falls back to the labels above.
 */
export const MUSCLE_WEIGHTS: Record<string, MuscleWeights> = {
  // ---- horizontal push: the flat/incline difference is the whole point ----
  barbell_bench_press: { chest: 1, triceps: 0.55, shoulders: 0.45, core: 0.2 },
  dumbbell_bench_press: { chest: 1, triceps: 0.5, shoulders: 0.5, core: 0.25 },
  incline_dumbbell_press: { chest: 0.85, shoulders: 0.7, triceps: 0.45, core: 0.25 },
  chest_press_machine: { chest: 1, triceps: 0.5, shoulders: 0.35 },
  push_up: { chest: 0.9, triceps: 0.55, shoulders: 0.4, core: 0.5 },
  // Flyes remove the elbow, so the triceps drop out almost entirely.
  cable_fly: { chest: 1, shoulders: 0.3, triceps: 0.1 },
  dumbbell_fly: { chest: 1, shoulders: 0.3, triceps: 0.1 },
  pec_deck: { chest: 1, shoulders: 0.25, triceps: 0.05 },

  // ---- vertical push ----
  overhead_press: { shoulders: 1, triceps: 0.6, core: 0.5, chest: 0.25 },
  dumbbell_shoulder_press: { shoulders: 1, triceps: 0.55, core: 0.3, chest: 0.2 },
  shoulder_press_machine: { shoulders: 1, triceps: 0.5, chest: 0.15 },
  // Raises are the clearest case: one muscle, and the arm is a lever.
  lateral_raise: { shoulders: 1, triceps: 0.05 },
  cable_lateral_raise: { shoulders: 1, triceps: 0.05 },
  rear_delt_fly: { shoulders: 0.9, back: 0.55 },
  face_pull: { shoulders: 0.8, back: 0.7, biceps: 0.15 },

  // ---- pulls: where the biceps sit is the useful distinction ----
  pull_up: { back: 1, biceps: 0.6, core: 0.3, shoulders: 0.25 },
  assisted_pull_up: { back: 1, biceps: 0.6, core: 0.25, shoulders: 0.25 },
  lat_pulldown: { back: 1, biceps: 0.55, shoulders: 0.2 },
  barbell_row: { back: 1, biceps: 0.5, core: 0.55, hamstrings: 0.3, shoulders: 0.3 },
  dumbbell_row: { back: 1, biceps: 0.5, core: 0.35, shoulders: 0.25 },
  seated_cable_row: { back: 1, biceps: 0.5, shoulders: 0.3 },
  // Chest-supported takes the trunk out, which is exactly why people pick it.
  chest_supported_row: { back: 1, biceps: 0.5, shoulders: 0.3, core: 0.1 },

  // ---- squats: front vs back changes the quad/glute/core balance ----
  back_squat: { quads: 1, glutes: 0.75, core: 0.55, hamstrings: 0.35, calves: 0.2 },
  front_squat: { quads: 1, core: 0.7, glutes: 0.6, hamstrings: 0.25, calves: 0.2 },
  goblet_squat: { quads: 0.9, glutes: 0.6, core: 0.6, hamstrings: 0.25 },
  hack_squat: { quads: 1, glutes: 0.5, hamstrings: 0.2, calves: 0.15 },
  leg_press: { quads: 1, glutes: 0.6, hamstrings: 0.25, calves: 0.15 },
  leg_extension: { quads: 1 },

  // ---- hinges ----
  deadlift: { hamstrings: 0.9, glutes: 0.9, back: 0.8, core: 0.7, quads: 0.5 },
  romanian_deadlift: { hamstrings: 1, glutes: 0.75, back: 0.6, core: 0.5, quads: 0.15 },
  trap_bar_deadlift: { quads: 0.75, glutes: 0.85, hamstrings: 0.7, back: 0.65, core: 0.6 },
  lying_leg_curl: { hamstrings: 1, calves: 0.2 },
  seated_leg_curl: { hamstrings: 1, calves: 0.15 },
  back_extension: { hamstrings: 0.7, glutes: 0.7, back: 0.8, core: 0.4 },
  // The hip thrust is the one lift where the glute is not sharing.
  hip_thrust: { glutes: 1, hamstrings: 0.5, quads: 0.25, core: 0.3 },

  // ---- single leg ----
  walking_lunge: { quads: 0.85, glutes: 0.85, hamstrings: 0.4, core: 0.45, calves: 0.25 },
  bulgarian_split_squat: { quads: 0.9, glutes: 0.85, hamstrings: 0.4, core: 0.5 },

  // ---- arms ----
  barbell_curl: { biceps: 1, shoulders: 0.1 },
  dumbbell_curl: { biceps: 1, shoulders: 0.1 },
  cable_curl: { biceps: 1, shoulders: 0.1 },
  triceps_pushdown: { triceps: 1 },
  // Overhead puts the long head on stretch, which is the reason to do it.
  overhead_triceps_extension: { triceps: 1, core: 0.2, shoulders: 0.15 },
  dip: { triceps: 0.9, chest: 0.85, shoulders: 0.5, core: 0.25 },

  // ---- calves and trunk ----
  standing_calf_raise: { calves: 1 },
  seated_calf_raise: { calves: 1 },
  plank: { core: 1, shoulders: 0.3, glutes: 0.3 },
  cable_crunch: { core: 1 },
  hanging_leg_raise: { core: 1, back: 0.2, biceps: 0.15 },

  // ---- conditioning ----
  stationary_bike: { quads: 0.7, hamstrings: 0.4, glutes: 0.4, calves: 0.3 },
  incline_walk: { calves: 0.6, glutes: 0.5, quads: 0.45, hamstrings: 0.35 },
  mobility_flow: { core: 0.4, glutes: 0.35, hamstrings: 0.3 },
};

/**
 * What this exercise asks of each muscle, ordered hardest-worked first.
 *
 * Empty for an unknown id, so a bad key draws an unlit body rather than a
 * confident diagram of nothing.
 */
export function muscleWeights(exerciseId: string): MuscleWeights {
  const tuned = MUSCLE_WEIGHTS[exerciseId];
  if (tuned) return tuned;

  const exercise = getExercise(exerciseId);
  if (!exercise) return {};

  const weights: MuscleWeights = { [exercise.primaryMuscle]: PRIMARY_WEIGHT };
  for (const muscle of exercise.secondaryMuscles) {
    weights[muscle] = SECONDARY_WEIGHT;
  }
  return weights;
}

/** The same thing as a sorted list, for legends and captions. */
export function rankedMuscles(exerciseId: string): { muscle: MuscleGroup; weight: number }[] {
  return Object.entries(muscleWeights(exerciseId))
    .map(([muscle, weight]) => ({ muscle: muscle as MuscleGroup, weight: weight ?? 0 }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

/**
 * How hard a muscle is worked, in words.
 *
 * The bands exist so the legend never implies more precision than the numbers
 * have. "Prime mover" and "assists" are honest; "0.55" would not be.
 */
export function effortLabel(weight: number): string {
  if (weight >= 0.85) return 'Prime mover';
  if (weight >= 0.55) return 'Works hard';
  if (weight >= 0.3) return 'Assists';
  return 'Barely involved';
}

/** Every exercise that has a hand-tuned split rather than the label fallback. */
export const TUNED_EXERCISE_IDS = Object.keys(MUSCLE_WEIGHTS);

/** Ids in the weight table that no longer exist in the library. */
export function orphanedWeightIds(): string[] {
  const known = new Set(EXERCISES.map((exercise) => exercise.id));
  return TUNED_EXERCISE_IDS.filter((id) => !known.has(id));
}
