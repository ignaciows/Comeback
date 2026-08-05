import { coachNotesFor, COACH_STAGE_ORDER, type CoachNotes } from '@/data/coachNotes';
import { EXERCISE_GUIDANCE } from '@/data/exerciseGuidance';
import { getExercise } from '@/data/exercises';
import type { MuscleGroup } from '@/domain/types';

/**
 * One exercise, unpacked into the stages you go through doing it.
 *
 * The screen used to be four separate boxes — a picture, a muscle map, a
 * setup list, a mistakes list — with no thread between them. You could read
 * all of it and still not know why any of it mattered, which is the difference
 * between following instructions and being able to correct yourself when the
 * instructions do not quite fit your body.
 *
 * A stage pairs what to do with why it matters, and they descend in the order
 * the rep actually happens: get into position, go down, come back up, feel the
 * right thing, then get better at it over weeks. The `why` is written per
 * movement pattern rather than per exercise, because that is the level the
 * reasons live at — every horizontal press wants the same shoulder blades,
 * whatever is in your hands.
 */

export type CascadeStage = {
  key: keyof CoachNotes;
  /** The coach's heading — a question or a claim, never a label. */
  title: string;
  /** Why it matters. Always present; this is the point of the whole thing. */
  why: string;
  /** The concrete instructions for this stage, when there are any. */
  points: string[];
  /** Set on the one stage that should draw the muscle map instead of a list. */
  showsMuscles?: boolean;
  /** Muscles to highlight, on the stage that shows them. */
  primaryMuscle?: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
};

/**
 * Empty for an exercise the library has never heard of, so a bad id renders
 * nothing rather than a confident page of generic advice.
 */
export function coachCascade(exerciseId: string): CascadeStage[] {
  const exercise = getExercise(exerciseId);
  if (!exercise) return [];

  const notes = coachNotesFor(exercise.pattern);
  const guidance = EXERCISE_GUIDANCE[exerciseId];

  /**
   * Execution is split across the two halves of the rep rather than listed
   * whole. The first step is nearly always getting into the bottom position
   * and the rest is coming back out of it, and separating them is what lets
   * each half carry its own reason.
   */
  const execution = guidance?.execution ?? [];
  const descent = execution.slice(0, 1);
  const ascent = execution.slice(1);

  const points: Record<keyof CoachNotes, string[]> = {
    position: guidance?.setup ?? [],
    range: descent,
    drive: ascent,
    // The focus stage draws the body instead of a list, so its "points" are
    // the cues — the things to hold in mind while feeling for the right thing.
    focus: guidance?.cues ?? [],
    // Progression has no per-exercise steps; what belongs here is what usually
    // goes wrong, because the fastest way to progress is to stop doing that.
    progress: guidance?.mistakes ?? [],
  };

  return COACH_STAGE_ORDER.map((key) => ({
    key,
    title: notes[key].title,
    why: notes[key].why,
    points: points[key],
    ...(key === 'focus'
      ? {
          showsMuscles: true,
          primaryMuscle: exercise.primaryMuscle,
          secondaryMuscles: exercise.secondaryMuscles,
        }
      : {}),
  }));
}

/**
 * The one line worth putting under the title before anyone scrolls.
 *
 * Someone who reads nothing else should still leave knowing what this lift is
 * for and what decides whether it works.
 */
export function cascadeSummary(exerciseId: string): string | null {
  const exercise = getExercise(exerciseId);
  if (!exercise) return null;

  const notes = coachNotesFor(exercise.pattern);
  return notes.range.why;
}
