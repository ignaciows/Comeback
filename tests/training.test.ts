import { describe, expect, it } from 'vitest';

import { buildInitialRoutine } from '@/data/routineTemplates';
import { findSubstitutions, getExercise } from '@/data/exercises';
import {
  bestE1rmByExercise,
  estimateOneRepMax,
  sessionSetCount,
  sessionVolume,
} from '@/domain/training/metrics';
import { estimateTargetDateImpact } from '@/domain/trajectory/estimateTargetDate';
import { daysBetween } from '@/utils/date';
import { TODAY, daysAgo, workout } from './helpers';

describe('training metrics', () => {
  it('estimates a one-rep max for low rep sets and refuses for high ones', () => {
    expect(estimateOneRepMax({ weightKg: 100, reps: 1 })).toBe(100);
    expect(estimateOneRepMax({ weightKg: 100, reps: 5 })).toBeGreaterThan(100);
    expect(estimateOneRepMax({ weightKg: 60, reps: 20 })).toBeNull();
    expect(estimateOneRepMax({ weightKg: null, reps: 5 })).toBeNull();
  });

  it('excludes warm-ups and incomplete sets from volume', () => {
    const session = workout(TODAY, [
      { weightKg: 40, reps: 10, warmup: true },
      { weightKg: 80, reps: 8 },
      { weightKg: 80, reps: 8, completed: false },
    ]);
    expect(sessionVolume(session)).toBe(640);
    expect(sessionSetCount(session)).toBe(1);
  });

  it('takes the best estimated 1RM across sessions', () => {
    const sessions = [
      workout(daysAgo(7), [{ weightKg: 80, reps: 5 }]),
      workout(daysAgo(1), [{ weightKg: 90, reps: 5 }]),
    ];
    const best = bestE1rmByExercise(sessions);
    expect(best.barbell_bench_press).toBeGreaterThan(100);
  });
});

describe('substitutions', () => {
  it('offers declared alternatives first', () => {
    const options = findSubstitutions('barbell_bench_press');
    expect(options[0].exercise.id).toBe('dumbbell_bench_press');
    expect(options.some((option) => option.exercise.id === 'push_up')).toBe(true);
  });

  it('demotes exercises whose equipment the gym does not have', () => {
    const options = findSubstitutions('barbell_bench_press', { machine: 'unavailable' });
    const machineIndex = options.findIndex((option) => option.exercise.id === 'chest_press_machine');
    const bodyweightIndex = options.findIndex((option) => option.exercise.id === 'push_up');
    expect(machineIndex).toBeGreaterThan(bodyweightIndex);
  });

  it('never suggests the exercise it is replacing', () => {
    const options = findSubstitutions('back_squat');
    expect(options.every((option) => option.exercise.id !== 'back_squat')).toBe(true);
  });
});

describe('initial routine', () => {
  it('builds the requested number of days', () => {
    const routine = buildInitialRoutine({
      daysPerWeek: 5,
      sessionMinutes: 60,
      location: 'gym',
      goalType: 'recomposition',
      layoffWeeks: 6,
    });
    expect(routine.days).toHaveLength(5);
    expect(routine.days.every((day) => day.exercises.length > 0)).toBe(true);
  });

  it('only uses home-friendly equipment when training at home', () => {
    const routine = buildInitialRoutine({
      daysPerWeek: 3,
      sessionMinutes: 45,
      location: 'home',
      goalType: 'regain_condition',
      layoffWeeks: 12,
    });
    const allowed = new Set(['bodyweight', 'dumbbell', 'kettlebell', 'band', 'bench']);
    for (const day of routine.days) {
      for (const exercise of day.exercises) {
        const meta = getExercise(exercise.exerciseId);
        expect(meta).toBeDefined();
        expect(meta?.equipment.every((item) => allowed.has(item))).toBe(true);
      }
    }
  });

  it('starts with less volume after a long layoff', () => {
    const fresh = buildInitialRoutine({
      daysPerWeek: 4,
      sessionMinutes: 75,
      location: 'gym',
      goalType: 'build_muscle',
      layoffWeeks: 0,
    });
    const detrained = buildInitialRoutine({
      daysPerWeek: 4,
      sessionMinutes: 75,
      location: 'gym',
      goalType: 'build_muscle',
      layoffWeeks: 20,
    });
    const total = (routine: typeof fresh) =>
      routine.days.reduce((sum, day) => sum + day.exercises.reduce((inner, e) => inner + e.sets, 0), 0);
    expect(total(detrained)).toBeLessThan(total(fresh));
  });
});

describe('trajectory', () => {
  it('pushes the target date out when the effective rate is below target', () => {
    const result = estimateTargetDateImpact({
      today: TODAY,
      goalStartedAt: daysAgo(28),
      horizonWeeks: 16,
      targetSessionsPerWeek: 5,
      completedSessions: 8,
      recentWeeklyRate: 2,
      weeksOfHistory: 4,
    });
    expect(daysBetween(TODAY, result.targetDate)).toBeGreaterThan(0);
    expect(result.driftDays).toBeGreaterThan(0);
    expect(result.recoverableDays).toBeGreaterThan(0);
  });

  it('costs at least a day to skip a session', () => {
    const result = estimateTargetDateImpact({
      today: TODAY,
      goalStartedAt: daysAgo(14),
      horizonWeeks: 12,
      targetSessionsPerWeek: 5,
      completedSessions: 10,
      recentWeeklyRate: 5,
      weeksOfHistory: 2,
    });
    expect(result.skipCostDays).toBeGreaterThanOrEqual(1);
    expect(result.confidence).toBe('low');
  });

  it('never projects beyond the configured horizon', () => {
    const result = estimateTargetDateImpact({
      today: TODAY,
      goalStartedAt: TODAY,
      horizonWeeks: 52,
      targetSessionsPerWeek: 6,
      completedSessions: 0,
      recentWeeklyRate: 0,
      weeksOfHistory: 0,
    });
    expect(daysBetween(TODAY, result.targetDate)).toBeLessThanOrEqual(104 * 7);
  });
});
