import { MUSCLE_GROUP_LABELS, getExercise } from '@/data/exercises';
import type { MuscleGroup, RoutineDay } from '@/domain/types';

/**
 * What "Upper A" actually means.
 *
 * The names in a routine are shorthand between people who already train.
 * Someone on their first week opens the app, reads "Upper Body A", and has no
 * idea whether that is arms, or a warm-up, or something they should be
 * nervous about. The name is not wrong — it is just not an explanation.
 *
 * So the description is *derived from the exercises in the day*, never
 * written by hand. A hand-written blurb goes stale the moment an exercise is
 * swapped; this cannot, because it is a reading of what is actually in there.
 */

export type DayDescription = {
  /** "Chest, back and shoulders" — the muscles, in plain words. */
  muscles: string;
  /** One sentence a beginner can act on. */
  plain: string;
  /** Muscles trained, most-worked first. */
  groups: MuscleGroup[];
  /** Weekly sets each muscle gets in this day, for shading a figure. */
  setsByMuscle: Partial<Record<MuscleGroup, number>>;
  exercises: number;
  sets: number;
};

/** Muscles below this share of the day's sets are noise, not the point of it. */
const MIN_SHARE = 0.12;

const UPPER: MuscleGroup[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps'];
const LOWER: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

export function describeDay(day: RoutineDay): DayDescription {
  const setsPerMuscle = new Map<MuscleGroup, number>();
  let totalSets = 0;

  for (const entry of day.exercises) {
    const exercise = getExercise(entry.exerciseId);
    if (!exercise) continue;
    setsPerMuscle.set(exercise.primaryMuscle, (setsPerMuscle.get(exercise.primaryMuscle) ?? 0) + entry.sets);
    totalSets += entry.sets;
  }

  const ranked = [...setsPerMuscle.entries()]
    .filter(([, sets]) => totalSets === 0 || sets / totalSets >= MIN_SHARE)
    .sort((a, b) => b[1] - a[1])
    .map(([muscle]) => muscle);

  return {
    groups: ranked,
    setsByMuscle: Object.fromEntries(setsPerMuscle),
    muscles: listOf(ranked.map((muscle) => MUSCLE_GROUP_LABELS[muscle].toLowerCase())),
    plain: plainSentence(ranked, day.exercises.length, totalSets),
    exercises: day.exercises.length,
    sets: totalSets,
  };
}

/**
 * The sentence itself.
 *
 * Named by the shape of the session rather than by listing muscles again: "everything
 * above the waist" tells a beginner more than "chest, back, shoulders, triceps
 * and biceps", which is the same information and none of the meaning.
 */
function plainSentence(groups: MuscleGroup[], exercises: number, sets: number): string {
  if (groups.length === 0) return 'Nothing in this day yet.';

  const upper = groups.filter((muscle) => UPPER.includes(muscle)).length;
  const lower = groups.filter((muscle) => LOWER.includes(muscle)).length;

  const shape =
    upper > 0 && lower > 0
      ? 'Whole body'
      : lower > 0
        ? 'Legs and hips'
        : 'Everything above the waist';

  const tail = `${exercises} movement${exercises === 1 ? '' : 's'}, ${sets} sets`;
  const lead = listOf(groups.slice(0, 3).map((muscle) => MUSCLE_GROUP_LABELS[muscle].toLowerCase()));

  return `${shape} — mostly ${lead}. ${tail}.`;
}

/** "a, b and c", because "a, b, c" reads like a database row. */
function listOf(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
