import type { WorkoutExercise, WorkoutSession } from '@/domain/types';

/**
 * Which exercise you are on, and what the others can be reduced to.
 *
 * The session screen laid every exercise out in full at once — the whole set
 * table, a column header, five action icons and three buttons, for each of
 * five or six movements. Everything was equally loud, so nothing told you
 * where you were, and the one question you have between sets is *what am I
 * doing right now and how much is left*.
 *
 * So exactly one exercise is open: the first one with work still in it. The
 * rest collapse to a line. Finishing a set moves the opening along on its own,
 * because a session should feel like it is closing rather than like a form
 * that has to be filled in.
 *
 * Warm-up sets are excluded from every count here, the same as everywhere
 * else — a ramp is not progress through the session, and counting it would
 * make the number jump when you add one.
 */

export type ExerciseState = 'done' | 'current' | 'upcoming' | 'skipped';

export type ExerciseFocus = {
  /** The `WorkoutExercise` id, not the catalogue id. */
  id: string;
  exerciseId: string;
  state: ExerciseState;
  setsDone: number;
  setsPlanned: number;
  /** One line for the collapsed row. Null when there is nothing worth saying. */
  summary: string | null;
};

export type SessionFocus = {
  items: ExerciseFocus[];
  /** The exercise to leave open, or null when they are all finished. */
  currentId: string | null;
  /** Which movement you are on, counting only the ones you are doing. */
  position: number;
  total: number;
};

const working = (exercise: WorkoutExercise) => exercise.sets.filter((set) => !set.warmup);

/**
 * What a collapsed row says.
 *
 * Done rows carry the top set, because that is the number you want when you
 * glance back at what you already did. Upcoming rows carry the shape of the
 * work — "3 × 8" — because that is what you are about to be asked for. Neither
 * needs the full table to answer the question it is being asked.
 */
function summarise(exercise: WorkoutExercise, state: ExerciseState): string | null {
  const sets = working(exercise);
  if (sets.length === 0) return null;

  if (state === 'done') {
    const completed = sets.filter((set) => set.completed);
    const top = completed.reduce<number | null>(
      (best, set) => (set.weightKg !== null && (best === null || set.weightKg > best) ? set.weightKg : best),
      null,
    );
    const count = `${completed.length} set${completed.length === 1 ? '' : 's'}`;
    return top === null ? count : `${count} · top ${top} kg`;
  }

  // Not started yet: the plan, as it was laid out.
  const reps = sets[0]?.reps;
  return reps ? `${sets.length} × ${reps}` : `${sets.length} set${sets.length === 1 ? '' : 's'}`;
}

export function sessionFocus(session: WorkoutSession): SessionFocus {
  let currentId: string | null = null;

  const items: ExerciseFocus[] = session.exercises.map((exercise) => {
    const sets = working(exercise);
    const setsDone = sets.filter((set) => set.completed).length;

    let state: ExerciseState;
    if (exercise.skipped) {
      state = 'skipped';
    } else if (sets.length > 0 && setsDone >= sets.length) {
      state = 'done';
    } else if (currentId === null) {
      // The first unfinished one, and only that one, is the live exercise.
      state = 'current';
      currentId = exercise.id;
    } else {
      state = 'upcoming';
    }

    return {
      id: exercise.id,
      exerciseId: exercise.exerciseId,
      state,
      setsDone,
      setsPlanned: sets.length,
      summary: summarise(exercise, state),
    };
  });

  // Position counts what you are actually doing, so skipping a movement moves
  // you forward rather than leaving a gap in the count.
  const doing = items.filter((item) => item.state !== 'skipped');
  const currentIndex = doing.findIndex((item) => item.id === currentId);

  return {
    items,
    currentId,
    // With everything finished there is no "current", and the honest position
    // is the end rather than zero.
    position: currentIndex === -1 ? doing.length : currentIndex + 1,
    total: doing.length,
  };
}

/** "Exercise 3 of 6", or what to say when there is nothing left. */
export function focusLabel(focus: SessionFocus): string {
  if (focus.total === 0) return 'Nothing added yet';
  if (focus.currentId === null) return `All ${focus.total} done`;
  return `${focus.position} of ${focus.total}`;
}
