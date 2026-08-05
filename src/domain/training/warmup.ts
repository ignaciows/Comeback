import { getExercise } from '@/data/exercises';
import {
  WARMUP_BY_EXERCISE,
  WARMUP_BY_PATTERN,
  type WarmupDrill,
} from '@/data/warmupProtocols';

/**
 * The specific warm-up: what to do before *this* lift.
 *
 * The session already opens with a general warm-up and every heavy compound
 * already gets its ramp sets. Neither of those covers the middle: a bench
 * press needs shoulders that will sit back, a deadlift needs hips that will
 * fold, and moving your ankles does nothing for either. Before a press you
 * need to move shoulders, not ankles — that gap is what this fills.
 *
 * Two to four movements, never more. This is the thing standing between
 * someone and their first set, and a warm-up long enough to be a workout is a
 * warm-up people learn to skip.
 */

/** How many drills is a warm-up, past which it is a workout. */
export const MAX_DRILLS = 4;

/**
 * Empty for most isolation work, and that is the answer rather than a gap.
 *
 * Preparing a cable curl costs more attention than it returns, and padding
 * every exercise with something would train people to tap past the screen —
 * including on the lifts where it matters.
 */
export function warmupForExercise(exerciseId: string): WarmupDrill[] {
  const override = WARMUP_BY_EXERCISE[exerciseId];
  if (override) return override.slice(0, MAX_DRILLS);

  const exercise = getExercise(exerciseId);
  if (!exercise) return [];

  return (WARMUP_BY_PATTERN[exercise.pattern] ?? []).slice(0, MAX_DRILLS);
}

/** Whether it is worth putting a screen in front of the first set at all. */
export function hasWarmup(exerciseId: string): boolean {
  return warmupForExercise(exerciseId).length > 0;
}

/**
 * Roughly how long the drills take, for the line on the screen.
 *
 * Deliberately coarse. The number exists so nobody has to wonder whether they
 * are about to lose five minutes, not to be accurate to the second.
 */
export function warmupMinutes(exerciseId: string): number {
  const drills = warmupForExercise(exerciseId);
  return drills.length === 0 ? 0 : Math.max(1, Math.round(drills.length * 0.5));
}
