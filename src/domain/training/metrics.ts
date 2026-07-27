import { trainingConfig } from '@/domain/config';
import type { MuscleGroup, WorkoutSession, WorkoutSet } from '@/domain/types';
import { round } from '@/utils/math';

/**
 * Estimated one-rep max (Epley). Only meaningful for low rep counts, so high-rep
 * sets return null rather than a confident-looking wrong number.
 */
export function estimateOneRepMax(set: Pick<WorkoutSet, 'weightKg' | 'reps'>): number | null {
  const { weightKg, reps } = set;
  if (weightKg === null || reps === null) return null;
  if (weightKg <= 0 || reps <= 0) return null;
  if (reps > trainingConfig.maxRepsForE1rm) return null;
  if (reps === 1) return round(weightKg, 1);
  return round(weightKg * (1 + reps / trainingConfig.e1rmCoefficient), 1);
}

/** Working sets only — warm-ups never count towards volume or records. */
export function workingSets(session: WorkoutSession): WorkoutSet[] {
  return session.exercises.flatMap((exercise) =>
    exercise.sets.filter((set) => set.completed && !set.warmup),
  );
}

export function setVolume(set: WorkoutSet): number {
  if (set.weightKg === null || set.reps === null) return 0;
  return set.weightKg * set.reps;
}

/** Total tonnage (kg × reps) of the completed working sets. */
export function sessionVolume(session: WorkoutSession): number {
  return round(workingSets(session).reduce((total, set) => total + setVolume(set), 0), 0);
}

export function sessionSetCount(session: WorkoutSession): number {
  return workingSets(session).length;
}

export function sessionDurationMinutes(session: WorkoutSession): number | null {
  if (!session.endedAt) return null;
  const ms = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

/** Best estimated 1RM per exercise across the given sessions. */
export function bestE1rmByExercise(sessions: WorkoutSession[]): Record<string, number> {
  const best: Record<string, number> = {};
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (!set.completed || set.warmup) continue;
        const e1rm = estimateOneRepMax(set);
        if (e1rm === null) continue;
        if (!best[exercise.exerciseId] || e1rm > best[exercise.exerciseId]) {
          best[exercise.exerciseId] = e1rm;
        }
      }
    }
  }
  return best;
}

/** Tonnage per exercise across the given sessions. */
export function volumeByExercise(sessions: WorkoutSession[]): Record<string, number> {
  const volume: Record<string, number> = {};
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (!set.completed || set.warmup) continue;
        volume[exercise.exerciseId] = (volume[exercise.exerciseId] ?? 0) + setVolume(set);
      }
    }
  }
  return volume;
}

/**
 * Tonnage per muscle group. Secondary muscles are credited at half, which is a
 * convention rather than a measurement — it is only used for relative bars.
 */
export function volumeByMuscleGroup(
  sessions: WorkoutSession[],
  resolve: (exerciseId: string) => { primaryMuscle: MuscleGroup; secondaryMuscles: MuscleGroup[] } | undefined,
): Partial<Record<MuscleGroup, number>> {
  const volume: Partial<Record<MuscleGroup, number>> = {};
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const meta = resolve(exercise.exerciseId);
      if (!meta) continue;
      const exerciseVolume = exercise.sets
        .filter((set) => set.completed && !set.warmup)
        .reduce((total, set) => total + setVolume(set), 0);
      if (exerciseVolume === 0) continue;
      volume[meta.primaryMuscle] = (volume[meta.primaryMuscle] ?? 0) + exerciseVolume;
      for (const muscle of meta.secondaryMuscles) {
        volume[muscle] = (volume[muscle] ?? 0) + exerciseVolume * 0.5;
      }
    }
  }
  return volume;
}

/** Muscle groups trained in the given sessions, for recommendation rules. */
export function muscleGroupsTrained(
  sessions: WorkoutSession[],
  resolve: (exerciseId: string) => { primaryMuscle: MuscleGroup } | undefined,
): MuscleGroup[] {
  const groups = new Set<MuscleGroup>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const meta = resolve(exercise.exerciseId);
      if (meta) groups.add(meta.primaryMuscle);
    }
  }
  return [...groups];
}
