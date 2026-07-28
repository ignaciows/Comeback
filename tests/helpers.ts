import type { PlannedOutcome, ReadinessPoint, SessionSummary } from '@/domain/momentum/components';
import type { DailyCheckin, ISODate, WorkoutSession } from '@/domain/types';
import { addDays } from '@/utils/date';

export const TODAY: ISODate = '2026-06-15';

export function daysAgo(count: number, from: ISODate = TODAY): ISODate {
  return addDays(from, -count);
}

export function session(date: ISODate, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return {
    id: `session-${date}-${Math.random().toString(36).slice(2, 8)}`,
    date,
    volumeKg: 6000,
    setCount: 16,
    e1rmByExercise: { barbell_bench_press: 90, back_squat: 120 },
    ...overrides,
  };
}

export function planned(date: ISODate, status: PlannedOutcome['status'], intent?: PlannedOutcome['intent']): PlannedOutcome {
  return { date, status, intent };
}

export function readiness(date: ISODate, score: number | null): ReadinessPoint {
  return { date, score };
}

export function checkin(date: ISODate, overrides: Partial<DailyCheckin> = {}): DailyCheckin {
  return {
    id: `checkin-${date}`,
    date,
    sleepHours: 7.5,
    sleepQuality: 4,
    energy: 4,
    soreness: 2,
    stress: 2,
    motivation: 4,
    source: 'manual',
    createdAt: `${date}T07:00:00.000Z`,
    updatedAt: `${date}T07:00:00.000Z`,
    ...overrides,
  };
}

/** A complete workout session with a single exercise, for metric tests. */
export function workout(
  date: ISODate,
  sets: { weightKg: number; reps: number; warmup?: boolean; completed?: boolean }[],
  exerciseId = 'barbell_bench_press',
): WorkoutSession {
  return {
    id: `workout-${date}`,
    date,
    startedAt: `${date}T18:00:00.000Z`,
    endedAt: `${date}T19:00:00.000Z`,
    name: 'Test session',
    routineId: null,
    routineDayId: null,
    plannedSessionId: null,
    intent: 'full',
    status: 'completed',
    notes: null,
    pauses: [],
    exercises: [
      {
        id: `exercise-${date}`,
        exerciseId,
        order: 0,
        substitutedFrom: null,
        note: null,
        skipped: false,
        sets: sets.map((set, index) => ({
          id: `set-${date}-${index}`,
          order: index,
          weightKg: set.weightKg,
          reps: set.reps,
          rir: 2,
          warmup: set.warmup ?? false,
          completed: set.completed ?? true,
          completedAt: `${date}T18:${10 + index}:00.000Z`,
        })),
      },
    ],
  };
}
