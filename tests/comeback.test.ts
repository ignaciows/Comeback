import { describe, expect, it } from 'vitest';

import {
  buildObservedBaseline,
  calculateComebackProgress,
} from '@/domain/comeback/calculateComebackProgress';
import { comebackConfig } from '@/domain/config';
import type { ComebackBaseline } from '@/domain/types';
import { TODAY } from './helpers';

const baseline: ComebackBaseline = {
  id: 'baseline-1',
  source: 'observed',
  establishedAt: '2026-04-01',
  exercises: [
    { exerciseId: 'barbell_bench_press', e1rmKg: 100 },
    { exerciseId: 'back_squat', e1rmKg: 140 },
  ],
  weeklySessions: 4,
  weeklyVolumeKg: 24_000,
  sampleSessions: 3,
};

describe('comeback progress', () => {
  it('refuses to report a number before a baseline exists', () => {
    const result = calculateComebackProgress({
      baseline: null,
      currentE1rmByExercise: { back_squat: 120 },
      currentWeeklyVolumeKg: 18_000,
      currentWeeklySessions: 3,
      sessionsSinceBaseline: 0,
    });
    expect(result.value).toBeNull();
    expect(result.status).toBe('establishing');
    expect(result.confidence).toBe('low');
  });

  it('scores partial recovery below the baseline', () => {
    const result = calculateComebackProgress({
      baseline,
      currentE1rmByExercise: { barbell_bench_press: 80, back_squat: 112 },
      currentWeeklyVolumeKg: 18_000,
      currentWeeklySessions: 3,
      sessionsSinceBaseline: 4,
    });
    expect(result.value).not.toBeNull();
    expect(result.value as number).toBeGreaterThan(60);
    expect(result.value as number).toBeLessThan(90);
    expect(result.matchedExercises).toBe(2);
  });

  it('never exceeds 100 even when performance is far past the baseline', () => {
    const result = calculateComebackProgress({
      baseline,
      currentE1rmByExercise: { barbell_bench_press: 300, back_squat: 400 },
      currentWeeklyVolumeKg: 200_000,
      currentWeeklySessions: 12,
      sessionsSinceBaseline: 30,
    });
    expect(result.value).toBeLessThanOrEqual(100);
    expect(result.exceedsBaseline).toBe(true);
  });

  it('never drops below zero', () => {
    const result = calculateComebackProgress({
      baseline,
      currentE1rmByExercise: { barbell_bench_press: 0.1 },
      currentWeeklyVolumeKg: 0,
      currentWeeklySessions: 0,
      sessionsSinceBaseline: 4,
    });
    expect(result.value).toBeGreaterThanOrEqual(0);
  });

  it('raises confidence as matched exercises and sessions accumulate', () => {
    const thin = calculateComebackProgress({
      baseline,
      currentE1rmByExercise: { back_squat: 130 },
      currentWeeklyVolumeKg: 20_000,
      currentWeeklySessions: 4,
      sessionsSinceBaseline: 1,
    });
    expect(thin.confidence).toBe('low');

    const wide: ComebackBaseline = {
      ...baseline,
      exercises: [
        ...baseline.exercises,
        { exerciseId: 'deadlift', e1rmKg: 160 },
        { exerciseId: 'overhead_press', e1rmKg: 60 },
        { exerciseId: 'barbell_row', e1rmKg: 90 },
      ],
    };
    const rich = calculateComebackProgress({
      baseline: wide,
      currentE1rmByExercise: {
        barbell_bench_press: 95,
        back_squat: 135,
        deadlift: 155,
        overhead_press: 58,
        barbell_row: 88,
      },
      currentWeeklyVolumeKg: 23_000,
      currentWeeklySessions: 4,
      sessionsSinceBaseline: 15,
    });
    expect(rich.confidence).toBe('high');
  });

  it('builds an observed baseline only after enough sessions', () => {
    const tooEarly = buildObservedBaseline(
      { e1rmByExercise: { back_squat: 100 }, weeklyVolumeKg: 10_000, weeklySessions: 3, sessionCount: 1 },
      TODAY,
      'id-1',
    );
    expect(tooEarly).toBeNull();

    const ready = buildObservedBaseline(
      {
        e1rmByExercise: { back_squat: 100 },
        weeklyVolumeKg: 10_000,
        weeklySessions: 3,
        sessionCount: comebackConfig.baselineSessions,
      },
      TODAY,
      'id-2',
    );
    expect(ready).not.toBeNull();
    expect(ready?.exercises).toHaveLength(1);
    expect(ready?.source).toBe('observed');
  });
});
