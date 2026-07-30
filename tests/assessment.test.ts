import { describe, expect, it } from 'vitest';

import { EXERCISES } from '@/data/exercises';
import {
  ASSESSMENT,
  MAX_RELIABLE_REPS,
  estimateOneRepMax,
  startingLoad,
  summarise,
} from '@/domain/training/assessment';

describe('estimating a maximum without testing one', () => {
  it('returns the weight itself for a single rep', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it('climbs with reps, because more reps at a weight means a higher max', () => {
    const five = estimateOneRepMax(100, 5)!;
    const ten = estimateOneRepMax(100, 10)!;

    expect(five).toBeGreaterThan(100);
    expect(ten).toBeGreaterThan(five);
  });

  it('lands where the standard formulas do', () => {
    // 100 kg for 10 is about 130–133 by Epley and Brzycki. A number far from
    // that band means the arithmetic drifted.
    const estimate = estimateOneRepMax(100, 10)!;

    expect(estimate).toBeGreaterThan(128);
    expect(estimate).toBeLessThan(136);
  });

  it('refuses rather than inventing a number past where the formulas hold', () => {
    expect(estimateOneRepMax(60, MAX_RELIABLE_REPS + 1)).toBeNull();
    expect(estimateOneRepMax(60, 25)).toBeNull();
    expect(estimateOneRepMax(0, 8)).toBeNull();
    expect(estimateOneRepMax(60, 0)).toBeNull();
  });
});

describe('what to actually put on the bar afterwards', () => {
  const repOut = { exerciseId: 'barbell_bench_press', weightKg: 60, reps: 10 };

  it('prescribes less than the estimate, never more', () => {
    const load = startingLoad(repOut, 8, 'returning', 8)!;

    expect(load.weightKg).toBeLessThan(load.oneRepMaxKg);
    // And below the weight they just did for ten, since this is day one back.
    expect(load.weightKg).toBeLessThanOrEqual(60);
  });

  it('starts a beginner lower than someone who never stopped', () => {
    const novice = startingLoad(repOut, 8, 'beginner', 0)!;
    const seasoned = startingLoad(repOut, 8, 'advanced', 0)!;

    expect(novice.weightKg).toBeLessThan(seasoned.weightKg);
  });

  it('takes a long layoff off the top', () => {
    const fresh = startingLoad(repOut, 8, 'returning', 0)!;
    const rusty = startingLoad(repOut, 8, 'returning', 52)!;

    expect(rusty.weightKg).toBeLessThan(fresh.weightKg);
  });

  it('gives a heavier weight for fewer reps', () => {
    const forFive = startingLoad(repOut, 5, 'returning', 4)!;
    const forTwelve = startingLoad(repOut, 12, 'returning', 4)!;

    expect(forFive.weightKg).toBeGreaterThan(forTwelve.weightKg);
  });

  it('rounds to something a gym has', () => {
    const load = startingLoad({ ...repOut, weightKg: 63.7 }, 8, 'returning', 3)!;

    expect(load.weightKg % 2.5).toBeCloseTo(0, 5);
  });

  it('never prescribes zero or a negative', () => {
    const load = startingLoad({ ...repOut, weightKg: 1 }, 12, 'beginner', 52)!;

    expect(load.weightKg).toBeGreaterThan(0);
  });

  it('says where the number came from', () => {
    const load = startingLoad(repOut, 8, 'returning', 4)!;

    expect(load.reason).toMatch(/10 reps at 60 kg/);
    expect(load.reason).toMatch(/estimated max/i);
  });

  it('declines when the rep-out was too long to read anything from', () => {
    expect(startingLoad({ ...repOut, reps: 20 }, 8, 'returning', 4)).toBeNull();
  });
});

describe('the assessment itself', () => {
  it('tests one movement per pattern and stays short enough to finish', () => {
    expect(ASSESSMENT.length).toBeLessThanOrEqual(6);
    expect(new Set(ASSESSMENT.map((item) => item.pattern)).size).toBe(ASSESSMENT.length);
  });

  it('only names exercises that exist', () => {
    const known = new Set(EXERCISES.map((exercise) => exercise.id));
    for (const item of ASSESSMENT) {
      expect(known.has(item.exerciseId), `${item.exerciseId} is not in the catalogue`).toBe(true);
    }
  });

  it('tells you how to do each test set', () => {
    for (const item of ASSESSMENT) {
      expect(item.instruction.length, item.exerciseId).toBeGreaterThan(30);
    }
  });

  it('summarises what was measured, and copes with nothing being measured', () => {
    const outcome = summarise(
      [
        { exerciseId: 'barbell_bench_press', weightKg: 60, reps: 10 },
        { exerciseId: 'leg_press', weightKg: 120, reps: 12 },
      ],
      8,
      'returning',
      6,
    );

    expect(outcome.loads).toHaveLength(2);
    expect(outcome.covered).toContain('horizontal_push');
    expect(outcome.covered).toContain('squat');
    expect(outcome.summary).toMatch(/2 movements measured/);

    expect(summarise([], 8, 'returning', 6).summary).toMatch(/keeps its own estimates/i);
  });

  it('drops an unreadable result instead of failing the whole assessment', () => {
    const outcome = summarise(
      [
        { exerciseId: 'barbell_bench_press', weightKg: 60, reps: 10 },
        { exerciseId: 'leg_press', weightKg: 120, reps: 30 },
      ],
      8,
      'returning',
      6,
    );

    expect(outcome.loads).toHaveLength(1);
  });
});
