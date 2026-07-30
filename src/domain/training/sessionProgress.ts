import type { WorkoutSession } from '@/domain/types';
import { round } from '@/utils/math';

/**
 * How far into the session you are, and how much of it was actually training.
 *
 * A session lasting ninety minutes with twenty of them spent on the phone is
 * not a ninety-minute session, and reporting it as one poisons every estimate
 * built on top — how long a session takes you, how much work fits in the time
 * you have. Pauses are subtracted.
 *
 * Nothing here requires the user to have paused. Someone who never touches the
 * pause button gets the same numbers they always did; the subtraction is just
 * zero.
 */

export type SessionProgress = {
  /** Working sets ticked off, and how many are laid out. */
  setsDone: number;
  setsPlanned: number;
  /** 0–1 across the sets that are laid out. Null when nothing is. */
  completion: number | null;
  exercisesDone: number;
  exercisesPlanned: number;
  /** Wall-clock seconds since the session started. */
  elapsedSeconds: number;
  /** Seconds spent inside deliberate pauses. */
  pausedSeconds: number;
  /** Elapsed minus paused — the honest length of the session. */
  activeSeconds: number;
  /** Set while a pause is running, in seconds. */
  currentPauseSeconds: number | null;
  isPaused: boolean;
};

/**
 * Where a session stands, as three cases a screen has to tell apart.
 *
 * `empty` and `complete` both mean "no set is waiting for you", and treating
 * them as one thing is how a free session that nobody has filled in yet ends up
 * being congratulated for finishing. They are not the same: one needs
 * exercises, the other needs saving.
 */
export type SessionStage = 'empty' | 'working' | 'complete';

export function sessionStage(progress: SessionProgress): SessionStage {
  if (progress.setsPlanned === 0) return 'empty';
  return progress.setsDone >= progress.setsPlanned ? 'complete' : 'working';
}

export function sessionProgress(session: WorkoutSession, now: Date = new Date()): SessionProgress {
  const end = session.endedAt ? new Date(session.endedAt).getTime() : now.getTime();
  const start = new Date(session.startedAt).getTime();
  const elapsedSeconds = Math.max(0, Math.round((end - start) / 1000));

  let pausedSeconds = 0;
  let currentPauseSeconds: number | null = null;

  for (const pause of session.pauses ?? []) {
    const from = new Date(pause.startedAt).getTime();
    const to = pause.endedAt ? new Date(pause.endedAt).getTime() : end;
    const seconds = Math.max(0, Math.round((to - from) / 1000));
    pausedSeconds += seconds;
    if (!pause.endedAt) currentPauseSeconds = seconds;
  }

  // Skipped exercises are not counted against you — leaving one out is a
  // decision, not a shortfall.
  const live = session.exercises.filter((exercise) => !exercise.skipped);
  const working = live.flatMap((exercise) => exercise.sets.filter((set) => !set.warmup));
  const setsDone = working.filter((set) => set.completed).length;

  return {
    setsDone,
    setsPlanned: working.length,
    completion: working.length === 0 ? null : round(setsDone / working.length, 2),
    exercisesDone: live.filter((exercise) => exercise.sets.some((set) => set.completed)).length,
    exercisesPlanned: live.length,
    elapsedSeconds,
    pausedSeconds,
    activeSeconds: Math.max(0, elapsedSeconds - pausedSeconds),
    currentPauseSeconds,
    isPaused: currentPauseSeconds !== null,
  };
}

/** "42:15" or "1:02:30". Used for the running session clock. */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => `${value}`.padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * How a pause compares to a normal rest.
 *
 * Deliberately not a judgement: a long pause is sometimes a phone call and
 * sometimes the right call. The app names what it sees and leaves it there.
 */
export function describePause(seconds: number, usualRestSeconds: number): string {
  if (seconds < usualRestSeconds) return 'Still inside a normal rest.';
  if (seconds < usualRestSeconds * 3) return 'Longer than your usual rest.';
  if (seconds < 900) return 'A real break. Loads may need a lighter first set back.';
  return 'Long enough that this is a second session. Warm up again before the next lift.';
}
