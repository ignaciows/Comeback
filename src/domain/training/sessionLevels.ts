import type { WorkoutSession } from '@/domain/types';
import { round } from '@/utils/math';

/**
 * The session as levels, not as a list.
 *
 * The guided screen already showed one set at a time, but the bar above it
 * drew a segment for every working set in the whole workout — twenty-four
 * slivers for six exercises of four sets, most of them about things you will
 * not touch for another forty minutes. That is the part that overwhelms: it
 * asks you to hold the entire session in your head while doing one set of it.
 *
 * A level is an exercise. A sublevel is a set. You can see the sublevels of
 * the level you are on, because "two more to go" is the question you have
 * between sets, and you cannot see the other levels at all, because they are
 * not your problem yet. What survives from the old bar is one line at the
 * foot: how much of the whole workout is behind you, with no sublevels in it.
 *
 * Warm-up sets are deliberately not sublevels. They belong to getting ready
 * for the level rather than to clearing it, and counting them would make the
 * first two "sets" of every exercise ones you cannot fail.
 */

export type Sublevel = {
  setId: string;
  /** 1-based, among the working sets of this level. */
  index: number;
  done: boolean;
  /** The set you are being asked for right now. */
  current: boolean;
};

export type SessionLevels = {
  /** 1-based position of the exercise in front of you, among the live ones. */
  level: number;
  levelCount: number;
  exerciseId: string;
  /** Sets of the current level only. The other levels stay out of sight. */
  sublevels: Sublevel[];
  /** 1-based. Zero when every set of this level is already done. */
  sublevel: number;
  sublevelCount: number;
  /** "Level 3 · set 2 of 4" */
  title: string;
  /** Levels fully cleared, counting only the ones you did not skip. */
  levelsCleared: number;
  /** 0–1 over the working sets of the whole session. */
  overall: number;
  /** "2 of 6 exercises · 40 % of the workout" */
  caption: string;
  /**
   * True when the set in front of you is the last one standing between you
   * and clearing this level. The screen uses it to arm the celebration before
   * the set is logged rather than after, so the pulse lands on the tap.
   */
  lastOfLevel: boolean;
};

/**
 * Null when there is no level to be on — nothing laid out, or everything done.
 *
 * Both of those are real states the screen already handles separately, and
 * returning a hollow level for them would make "you have finished" and "you
 * have not started" look identical to anything reading this.
 */
export function sessionLevels(session: WorkoutSession): SessionLevels | null {
  // Skipped exercises are not levels. Leaving one out is a decision, and
  // making it a level you failed to clear punishes the decision.
  const live = session.exercises.filter((exercise) => !exercise.skipped);
  const workingSetsOf = (exercise: (typeof live)[number]) =>
    exercise.sets.filter((set) => !set.warmup);

  const allWorking = live.flatMap(workingSetsOf);
  const overallDone = allWorking.filter((set) => set.completed).length;
  const overall = allWorking.length === 0 ? 0 : round(overallDone / allWorking.length, 2);

  const levelsCleared = live.filter((exercise) => {
    const sets = workingSetsOf(exercise);
    return sets.length > 0 && sets.every((set) => set.completed);
  }).length;

  const position = live.findIndex((exercise) => exercise.sets.some((set) => !set.completed));
  if (position < 0) return null;

  const exercise = live[position];
  const working = workingSetsOf(exercise);

  // The current set is found across every set of the exercise, warm-ups
  // included, because that is the one the screen is actually asking for; only
  // its *numbering* ignores warm-ups.
  const currentSetId = exercise.sets.find((set) => !set.completed)?.id ?? null;

  const sublevels: Sublevel[] = working.map((set, index) => ({
    setId: set.id,
    index: index + 1,
    done: set.completed,
    current: set.id === currentSetId,
  }));

  const currentSublevel = sublevels.find((entry) => entry.current)?.index ?? 0;
  const remaining = sublevels.filter((entry) => !entry.done).length;

  const level = position + 1;
  const title =
    currentSublevel > 0
      ? `Level ${level} · set ${currentSublevel} of ${sublevels.length}`
      : `Level ${level} · warm-up`;

  return {
    level,
    levelCount: live.length,
    exerciseId: exercise.exerciseId,
    sublevels,
    sublevel: currentSublevel,
    sublevelCount: sublevels.length,
    title,
    levelsCleared,
    overall,
    caption: `${levelsCleared} of ${live.length} exercises · ${Math.round(overall * 100)} % of the workout`,
    lastOfLevel: currentSublevel > 0 && remaining === 1,
  };
}
