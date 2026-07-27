import type { WorkoutSession, WorkoutSet } from '@/domain/types';

/** The most recent completed session that contains the given exercise. */
export function previousPerformance(
  sessions: WorkoutSession[],
  exerciseId: string,
  excludeSessionId?: string,
): { date: string; sets: WorkoutSet[] } | null {
  const ordered = sessions
    .filter((session) => session.status === 'completed' && session.id !== excludeSessionId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  for (const session of ordered) {
    const exercise = session.exercises.find((entry) => entry.exerciseId === exerciseId);
    if (!exercise) continue;
    const sets = exercise.sets.filter((set) => set.completed && !set.warmup);
    if (sets.length > 0) return { date: session.date, sets };
  }
  return null;
}

/** "60 × 8" for the set in the same position last time. */
export function formatPreviousSet(set: WorkoutSet | undefined): string | null {
  if (!set || set.weightKg === null || set.reps === null) return null;
  return `${set.weightKg} × ${set.reps}`;
}
