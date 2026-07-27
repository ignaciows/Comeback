import type { WorkoutSession } from '@/domain/types';
import { mean, round } from '@/utils/math';

/**
 * What actually happened during a session, derived from the timestamps already
 * recorded on every completed set. No wearable needed: the phone knows when
 * each set was confirmed, which is enough for duration, rest and pauses.
 *
 * When Apple Watch is connected these are replaced by measured values through
 * the health port; the shape stays the same, so nothing downstream changes.
 */

export type SessionMechanics = {
  /** Wall-clock length of the session. Null while it is still running. */
  durationMinutes: number | null;
  workingSets: number;
  /** Median gap between consecutive working sets, in seconds. */
  medianRestSeconds: number | null;
  longestGapSeconds: number | null;
  /** Gaps longer than five minutes: phone calls, queues, distractions. */
  pauses: number;
  /** Working sets per hour — how dense the session was. */
  setsPerHour: number | null;
  /** Completed sets over sets that were laid out, 0–1. Null if nothing planned. */
  completionRatio: number | null;
};

const PAUSE_THRESHOLD_SECONDS = 300;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function sessionMechanics(session: WorkoutSession, plannedSets: number | null = null): SessionMechanics {
  const stamps = session.exercises
    .flatMap((exercise) => exercise.sets)
    .filter((set) => set.completed && !set.warmup && set.completedAt)
    .map((set) => new Date(set.completedAt as string).getTime())
    .sort((a, b) => a - b);

  const durationMs = session.endedAt
    ? new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()
    : null;
  const durationMinutes = durationMs === null ? null : Math.max(0, Math.round(durationMs / 60_000));

  const gaps: number[] = [];
  for (let index = 1; index < stamps.length; index += 1) {
    gaps.push(Math.round((stamps[index] - stamps[index - 1]) / 1000));
  }

  const restGaps = gaps.filter((gap) => gap < PAUSE_THRESHOLD_SECONDS);
  const workingSets = stamps.length;

  return {
    durationMinutes,
    workingSets,
    medianRestSeconds: median(restGaps),
    longestGapSeconds: gaps.length > 0 ? Math.max(...gaps) : null,
    pauses: gaps.filter((gap) => gap >= PAUSE_THRESHOLD_SECONDS).length,
    setsPerHour:
      durationMinutes && durationMinutes > 0 ? round((workingSets / durationMinutes) * 60, 1) : null,
    completionRatio: plannedSets && plannedSets > 0 ? round(Math.min(1, workingSets / plannedSets), 2) : null,
  };
}

/** Average rest across recent sessions, for the "you rest X" line. */
export function averageRestSeconds(sessions: WorkoutSession[]): number | null {
  const values = sessions
    .map((session) => sessionMechanics(session).medianRestSeconds)
    .filter((value): value is number => value !== null);
  return values.length === 0 ? null : Math.round(mean(values));
}

/**
 * A session where only a fraction of the laid-out work was completed counts as
 * a reduced session, not a full one — the same credit a deliberately shortened
 * session gets.
 */
export function wasReduced(mechanics: SessionMechanics): boolean {
  return mechanics.completionRatio !== null && mechanics.completionRatio < 0.6;
}
