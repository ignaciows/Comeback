import { getExercise } from '@/data/exercises';
import type { Exercise, WorkoutSet } from '@/domain/types';
import { round } from '@/utils/math';

/**
 * What a coach standing next to you would actually do.
 *
 * Not the encouragement — the four things a good one does between sets that
 * an app can also do, deterministically, from data it already has:
 *
 *  1. **Pick the load for the next set.** Autoregulation: if the last set left
 *     more reps in reserve than the target, the weight was light; if fewer, it
 *     was heavy. Helms' RIR-based scale is the usual formulation, and the
 *     adjustment is small because a coach nudges rather than jumps.
 *
 *  2. **Progress the load when it is earned.** Double progression: work up the
 *     rep range at a fixed weight, and only add load once the top of the range
 *     is hit on every working set. It is the rule least likely to run someone
 *     into a wall, which is why it is the default for people coming back.
 *
 *  3. **Warm up the first heavy set.** Two or three ramping sets before the
 *     first working set of a compound — enough to rehearse the pattern under
 *     load without spending the session.
 *
 *  4. **Say one thing.** Not five. Working memory is the constraint during a
 *     set, and a stack of instructions degrades the rep it was meant to fix.
 *
 * On cueing there is a genuine split in the evidence, and the app follows it:
 * an **external** focus — on the effect of the movement, "push the floor away"
 * — beats an internal one for force production and skill learning (Wulf's
 * reviews are the standard reference). For isolation work aimed at growth the
 * picture reverses: Schoenfeld et al. (2018) found an internal focus, the
 * mind-muscle connection, produced more biceps growth. So compounds get
 * external cues and isolation gets internal ones.
 */

export type CueFocus = 'external' | 'internal' | 'safety';

export type Cue = {
  text: string;
  focus: CueFocus;
};

export type LoadSuggestion = {
  weightKg: number | null;
  reps: number;
  /** Why this number, in a few words. Null on the first ever set. */
  reason: string | null;
  kind: 'same' | 'heavier' | 'lighter' | 'first_time';
};

/** RIR the app aims for on a working set: hard, but not to failure. */
export const TARGET_RIR = 2;

/**
 * The smallest change worth making to a barbell, and to a dumbbell.
 *
 * Rounding to what a gym actually stocks matters more than arithmetic
 * precision: telling someone to load 63.7 kg is telling them nothing.
 */
function increment(exercise: Exercise | undefined): number {
  if (!exercise) return 2.5;
  if (exercise.equipment.includes('dumbbell')) return 2;
  if (exercise.equipment.includes('machine') || exercise.equipment.includes('cable')) return 2.5;
  if (!exercise.isCompound) return 2.5;
  return 2.5;
}

function roundToIncrement(weightKg: number, step: number): number {
  return round(Math.max(step, Math.round(weightKg / step) * step), 1);
}

export type LoadInput = {
  exerciseId: string;
  /** The set just completed on this exercise, if there is one. */
  lastSet: WorkoutSet | null;
  /** Every completed working set of this exercise in this session. */
  setsThisSession: WorkoutSet[];
  repMin: number;
  repMax: number;
  /** The best working set from the last time this exercise was trained. */
  previousBest: { weightKg: number | null; reps: number | null } | null;
};

/**
 * What to put on the bar for the next set.
 *
 * Within a session the load only moves when the reps say it should, and it
 * moves by one increment. Between sessions, double progression decides.
 */
export function suggestLoad(input: LoadInput): LoadSuggestion {
  const exercise = getExercise(input.exerciseId);
  const step = increment(exercise);
  const midReps = Math.round((input.repMin + input.repMax) / 2);

  // --- Mid-session: react to the set that just happened --------------------
  if (input.lastSet?.completed && input.lastSet.weightKg !== null && input.lastSet.reps !== null) {
    const { weightKg, reps, rir } = input.lastSet;

    if (rir !== null) {
      if (rir >= TARGET_RIR + 2) {
        return {
          weightKg: roundToIncrement(weightKg + step, step),
          reps: midReps,
          reason: `Last set had ${rir} left in the tank. Up ${step} kg.`,
          kind: 'heavier',
        };
      }
      if (rir <= TARGET_RIR - 2) {
        return {
          weightKg: roundToIncrement(weightKg - step, step),
          reps: midReps,
          reason: 'That was close to failure. Down a notch so the next set is still clean.',
          kind: 'lighter',
        };
      }
    }

    // No RIR recorded: use the reps against the range instead.
    if (reps > input.repMax) {
      return {
        weightKg: roundToIncrement(weightKg + step, step),
        reps: midReps,
        reason: `${reps} reps is past the range. Up ${step} kg.`,
        kind: 'heavier',
      };
    }
    if (reps < input.repMin) {
      return {
        weightKg: roundToIncrement(weightKg - step, step),
        reps: input.repMin,
        reason: 'Short of the range. Take a little off and finish the sets.',
        kind: 'lighter',
      };
    }

    // "Same again" has to mean the same reps too. Suggesting the middle of the
    // range here is what made someone re-enter their number on every single
    // set: they do ten, and the app keeps proposing eight.
    return { weightKg, reps, reason: 'Same again.', kind: 'same' };
  }

  // --- First set of the exercise: double progression from last time --------
  if (input.previousBest?.weightKg != null) {
    const { weightKg, reps } = input.previousBest;

    if (reps !== null && reps >= input.repMax) {
      return {
        weightKg: roundToIncrement(weightKg + step, step),
        reps: input.repMin,
        reason: `You hit ${reps} last time — top of the range, so the weight goes up.`,
        kind: 'heavier',
      };
    }

    return {
      weightKg,
      reps: Math.min(input.repMax, (reps ?? input.repMin) + 1),
      reason: 'Same weight, one more rep than last time.',
      kind: 'same',
    };
  }

  return {
    weightKg: null,
    reps: midReps,
    reason: null,
    kind: 'first_time',
  };
}

/**
 * The ramp before the first working set.
 *
 * Percentages of the working weight, light and quick. Only for compounds:
 * warming up a cable curl costs more attention than it returns.
 */
export function warmupSets(exerciseId: string, workingWeightKg: number | null): { weightKg: number; reps: number }[] {
  const exercise = getExercise(exerciseId);
  if (!exercise?.isCompound || workingWeightKg === null || workingWeightKg < 30) return [];

  const step = increment(exercise);
  return [
    { weightKg: roundToIncrement(workingWeightKg * 0.5, step), reps: 8 },
    { weightKg: roundToIncrement(workingWeightKg * 0.7, step), reps: 5 },
    { weightKg: roundToIncrement(workingWeightKg * 0.85, step), reps: 3 },
  ];
}

/**
 * One thing to think about during this set.
 *
 * Rotating by set index rather than showing a list: the point is that only one
 * instruction is live at a time. Which pool it comes from depends on the
 * movement — external for compounds, internal for isolation.
 */
export function cueForSet(exerciseId: string, setIndex: number, pool: Cue[]): Cue | null {
  const exercise = getExercise(exerciseId);
  if (pool.length === 0) return null;

  // A safety cue always leads, and only on the first set — after that it is
  // noise, and the person is already moving.
  const safety = pool.find((cue) => cue.focus === 'safety');
  if (safety && setIndex === 0) return safety;

  const rest = pool.filter((cue) => cue.focus !== 'safety');
  if (rest.length === 0) return safety ?? null;

  const preferred = exercise?.isCompound ? 'external' : 'internal';
  const matching = rest.filter((cue) => cue.focus === preferred);
  const chosen = matching.length > 0 ? matching : rest;

  return chosen[setIndex % chosen.length];
}

/** Rest after a set, in seconds. Compounds need more than isolation does. */
export function restForSet(exerciseId: string, isLastSet: boolean): number {
  const exercise = getExercise(exerciseId);
  if (isLastSet) return 60;
  // Schoenfeld et al. (2016): longer rest produced more hypertrophy than one
  // minute, so the compound default is deliberately not short.
  return exercise?.isCompound ? 180 : 90;
}
