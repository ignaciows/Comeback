import { EXERCISES, getExercise } from '@/data/exercises';
import type { EquipmentAvailability, MuscleGroup, Routine, RoutineDay } from '@/domain/types';
import { createId } from '@/utils/id';
import { clamp, round } from '@/utils/math';

/**
 * Weekly volume per muscle, and how to shift it towards what the user cares
 * about.
 *
 * The numbers come from the dose-response work on set volume: growth rises
 * with weekly sets per muscle up to roughly 20, with most of the benefit
 * between 10 and 20 and clear diminishing returns above that (Schoenfeld,
 * Ogborn & Krieger 2017; Baz-Valle et al. 2022). Below about 10 the stimulus
 * is maintenance rather than growth for most trained muscles, which is why
 * that is the floor a de-emphasised muscle is never pushed under.
 *
 * A set counts fully for the muscle the exercise is built around and half for
 * the ones it involves — a bench press is chest work that also loads triceps,
 * and pretending otherwise inflates every push muscle.
 */

export const VOLUME_BANDS = {
  /** Under this, a muscle is being maintained, not grown. */
  maintenance: 10,
  /** The middle of the productive range. */
  target: 15,
  /** Above this, more sets mostly buy fatigue. */
  ceiling: 20,
} as const;

/** What a muscle gets when it is being emphasised versus carried. */
const FOCUS_TARGET = 18;
const BASE_TARGET = 12;

export const SECONDARY_WEIGHT = 0.5;

export type MuscleVolume = {
  muscle: MuscleGroup;
  sets: number;
  status: 'under' | 'in_range' | 'over';
  focused: boolean;
};

/** Weekly sets per muscle implied by a routine, assuming it is all completed. */
export function weeklySetsByMuscle(routine: Routine | null): Partial<Record<MuscleGroup, number>> {
  const totals: Partial<Record<MuscleGroup, number>> = {};
  if (!routine) return totals;

  for (const day of routine.days) {
    for (const entry of day.exercises) {
      const exercise = getExercise(entry.exerciseId);
      if (!exercise) continue;
      totals[exercise.primaryMuscle] = (totals[exercise.primaryMuscle] ?? 0) + entry.sets;
      for (const muscle of exercise.secondaryMuscles) {
        totals[muscle] = (totals[muscle] ?? 0) + entry.sets * SECONDARY_WEIGHT;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(totals).map(([muscle, sets]) => [muscle, round(sets, 1)]),
  ) as Partial<Record<MuscleGroup, number>>;
}

const ALL_MUSCLES: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'quads',
  'hamstrings',
  'glutes',
  'biceps',
  'triceps',
  'calves',
  'core',
];

/** Every muscle with its weekly sets and whether that lands in the useful range. */
export function volumeBreakdown(
  routine: Routine | null,
  focus: MuscleGroup[] = [],
): MuscleVolume[] {
  const totals = weeklySetsByMuscle(routine);

  return ALL_MUSCLES.map((muscle): MuscleVolume => {
    const sets = totals[muscle] ?? 0;
    const focused = focus.includes(muscle);
    const floor = focused ? VOLUME_BANDS.target : VOLUME_BANDS.maintenance;

    return {
      muscle,
      sets,
      focused,
      status: sets < floor ? 'under' : sets > VOLUME_BANDS.ceiling ? 'over' : 'in_range',
    };
  }).sort((a, b) => b.sets - a.sets);
}

// ---------------------------------------------------------------------------
// Shifting the routine towards the muscles the user picked

function isUsable(exerciseId: string, equipment: Record<string, EquipmentAvailability>): boolean {
  const exercise = getExercise(exerciseId);
  if (!exercise) return false;
  return exercise.equipment.every((item) => equipment[item] !== 'unavailable');
}

/** The best isolation movement for a muscle that the gym can actually do. */
function accessoryFor(
  muscle: MuscleGroup,
  equipment: Record<string, EquipmentAvailability>,
  exclude: Set<string>,
): string | null {
  const candidates = EXERCISES.filter(
    (exercise) =>
      exercise.primaryMuscle === muscle &&
      !exercise.isCompound &&
      !exclude.has(exercise.id) &&
      isUsable(exercise.id, equipment),
  ).sort((a, b) => a.difficulty - b.difficulty);

  return candidates[0]?.id ?? null;
}

export type EmphasisResult = {
  routine: Routine;
  /** Muscle → sets added or removed, for the "what changed" readout. */
  deltas: Partial<Record<MuscleGroup, number>>;
  changed: boolean;
};

/**
 * Rebalances a routine towards the chosen muscles.
 *
 * Volume is moved, not simply added: sets come off the muscles that are not
 * the priority — never below the maintenance floor — and go onto the ones that
 * are. That keeps session length roughly where it was, which is the whole
 * reason someone picks a focus instead of just training more.
 */
export function applyEmphasis(
  routine: Routine,
  focus: MuscleGroup[],
  equipment: Record<string, EquipmentAvailability> = {},
): EmphasisResult {
  if (focus.length === 0) return { routine, deltas: {}, changed: false };

  const before = weeklySetsByMuscle(routine);
  const used = new Set(routine.days.flatMap((day) => day.exercises.map((entry) => entry.exerciseId)));

  /**
   * Running tally, updated as each cut is made. Deciding against the starting
   * volume instead would let three exercises each conclude there is room for
   * one more set to come off, and between them take the muscle under the floor.
   */
  const running: Partial<Record<MuscleGroup, number>> = { ...before };

  /** A set off this exercise costs its primary muscle one and each assisting muscle half. */
  const costOfRemoving = (exerciseId: string): Partial<Record<MuscleGroup, number>> => {
    const exercise = getExercise(exerciseId);
    if (!exercise) return {};
    const cost: Partial<Record<MuscleGroup, number>> = { [exercise.primaryMuscle]: 1 };
    for (const muscle of exercise.secondaryMuscles) {
      cost[muscle] = (cost[muscle] ?? 0) + SECONDARY_WEIGHT;
    }
    return cost;
  };

  const days: RoutineDay[] = routine.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((entry) => {
      const exercise = getExercise(entry.exerciseId);
      if (!exercise) return entry;

      if (focus.includes(exercise.primaryMuscle)) {
        // One extra set per exercise, capped — five working sets on one
        // movement is already the top of what a session can carry.
        const sets = clamp(entry.sets + 1, 2, 5);
        if (sets !== entry.sets) {
          running[exercise.primaryMuscle] = (running[exercise.primaryMuscle] ?? 0) + 1;
          for (const muscle of exercise.secondaryMuscles) {
            running[muscle] = (running[muscle] ?? 0) + SECONDARY_WEIGHT;
          }
        }
        return { ...entry, sets };
      }

      if (entry.sets <= 2) return entry;

      // Take the set off only if every muscle it touches can spare it. A
      // focused muscle never gives volume back, whatever it is assisting.
      const cost = costOfRemoving(entry.exerciseId);
      const affordable = Object.entries(cost).every(([muscle, amount]) => {
        if (focus.includes(muscle as MuscleGroup)) return false;
        // Has to still clear the floor afterwards, which also means a muscle
        // already under it gives nothing up — it is the weak spot already.
        return (running[muscle as MuscleGroup] ?? 0) - (amount as number) >= VOLUME_BANDS.maintenance;
      });

      if (!affordable) return entry;

      for (const [muscle, amount] of Object.entries(cost)) {
        running[muscle as MuscleGroup] = (running[muscle as MuscleGroup] ?? 0) - (amount as number);
      }
      return { ...entry, sets: entry.sets - 1 };
    }),
  }));

  // Still short on a priority muscle: add one movement for it.
  const interim: Routine = { ...routine, days };
  const afterSets = weeklySetsByMuscle(interim);

  for (const muscle of focus) {
    if ((afterSets[muscle] ?? 0) >= FOCUS_TARGET) continue;

    const exerciseId = accessoryFor(muscle, equipment, used);
    if (!exerciseId) continue;
    used.add(exerciseId);

    // Put it on the day that already trains this muscle, or the shortest day.
    const host =
      days.find((day) => day.focus.includes(muscle)) ??
      [...days].sort((a, b) => a.exercises.length - b.exercises.length)[0];
    if (!host) continue;

    host.exercises = [
      ...host.exercises,
      {
        id: createId(),
        exerciseId,
        order: host.exercises.length,
        sets: 3,
        repMin: 10,
        repMax: 15,
        restSeconds: 90,
      },
    ];
  }

  const after = weeklySetsByMuscle({ ...routine, days });
  const deltas: Partial<Record<MuscleGroup, number>> = {};
  for (const muscle of ALL_MUSCLES) {
    const delta = round((after[muscle] ?? 0) - (before[muscle] ?? 0), 1);
    if (delta !== 0) deltas[muscle] = delta;
  }

  return {
    routine: { ...routine, days },
    deltas,
    changed: Object.keys(deltas).length > 0,
  };
}

/** Muscles a plain routine already covers well, used to pre-select nothing. */
export function underservedMuscles(routine: Routine | null): MuscleGroup[] {
  return volumeBreakdown(routine)
    .filter((entry) => entry.status === 'under')
    .map((entry) => entry.muscle);
}

export const BASE_TARGET_SETS = BASE_TARGET;
export const FOCUS_TARGET_SETS = FOCUS_TARGET;
