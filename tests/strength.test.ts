import { describe, expect, it } from 'vitest';

import {
  STALL_WEEKS,
  nextTarget,
  stalls,
  strengthByExercise,
  summariseStrength,
} from '@/domain/training/strength';
import type { WorkoutSession } from '@/domain/types';

let counter = 0;

const session = (
  date: string,
  entries: { exerciseId: string; sets: { weightKg: number; reps: number; warmup?: boolean }[] }[],
  status: WorkoutSession['status'] = 'completed',
): WorkoutSession =>
  ({
    id: `s${counter++}`,
    date,
    startedAt: `${date}T18:00:00.000Z`,
    endedAt: `${date}T19:00:00.000Z`,
    name: 'Session',
    routineId: null,
    routineDayId: null,
    plannedSessionId: null,
    intent: 'full',
    status,
    notes: null,
    pauses: [],
    exercises: entries.map((entry, index) => ({
      id: `we${index}`,
      exerciseId: entry.exerciseId,
      order: index,
      substitutedFrom: null,
      note: null,
      skipped: false,
      sets: entry.sets.map((set, setIndex) => ({
        id: `set${index}-${setIndex}`,
        order: setIndex,
        weightKg: set.weightKg,
        reps: set.reps,
        rir: 2,
        warmup: set.warmup ?? false,
        completed: true,
        completedAt: `${date}T18:30:00.000Z`,
      })),
    })),
  }) as WorkoutSession;

const bench = (date: string, weightKg: number, reps = 8) =>
  session(date, [{ exerciseId: 'barbell_bench_press', sets: [{ weightKg, reps }] }]);

describe('what you lift, week by week', () => {
  it('records one point per week, keeping the best set of that week', () => {
    // A light Tuesday should not erase what Friday proved.
    const sessions = [
      session('2026-06-01', [
        { exerciseId: 'barbell_bench_press', sets: [{ weightKg: 60, reps: 8 }] },
      ]),
      session('2026-06-05', [
        { exerciseId: 'barbell_bench_press', sets: [{ weightKg: 70, reps: 8 }] },
      ]),
    ];

    const [entry] = strengthByExercise(sessions);

    expect(entry.history).toHaveLength(1);
    expect(entry.history[0].weightKg).toBe(70);
    expect(entry.history[0].sets).toBe(2);
  });

  it('compounds across weeks and reports what was added', () => {
    const sessions = [
      bench('2026-06-01', 60),
      bench('2026-06-08', 62.5),
      bench('2026-06-15', 65),
      bench('2026-06-22', 67.5),
    ];

    const [entry] = strengthByExercise(sessions);

    expect(entry.history).toHaveLength(4);
    expect(entry.changeKg).toBeGreaterThan(0);
    expect(entry.weeksSpanned).toBe(3);
    expect(entry.perWeekKg).toBeGreaterThan(0);
    expect(entry.changePct).toBeGreaterThan(0);
  });

  it('compares across rep ranges, which raw weight cannot', () => {
    // 70 kg for 5 is a weaker set than 65 kg for 10, and a screen that ranked
    // by weight alone would call it progress.
    const sessions = [bench('2026-06-01', 65, 10), bench('2026-06-08', 70, 5)];
    const [entry] = strengthByExercise(sessions);

    expect(entry.current.weightKg).toBe(70);
    expect(entry.changeKg).toBeLessThan(0);
  });

  it('refuses a weekly rate until there is enough span to mean one', () => {
    // Two sessions a week apart is not a trend, and a rate from it would be a
    // line drawn through noise and then trusted.
    const [entry] = strengthByExercise([bench('2026-06-01', 60), bench('2026-06-08', 70)]);

    expect(entry.perWeekKg).toBeNull();
    expect(entry.changeKg).toBeGreaterThan(0);
  });

  it('ignores warm-ups and unfinished sessions', () => {
    const sessions = [
      session('2026-06-01', [
        {
          exerciseId: 'barbell_bench_press',
          sets: [
            { weightKg: 100, reps: 5, warmup: true },
            { weightKg: 60, reps: 8 },
          ],
        },
      ]),
      session('2026-06-08', [{ exerciseId: 'barbell_bench_press', sets: [{ weightKg: 200, reps: 5 }] }], 'active'),
    ];

    const [entry] = strengthByExercise(sessions);

    expect(entry.history).toHaveLength(1);
    expect(entry.current.weightKg).toBe(60);
    expect(entry.totalSets).toBe(1);
  });

  it('drops a set the formulas cannot read rather than distorting the record', () => {
    const sessions = [
      session('2026-06-01', [
        {
          exerciseId: 'barbell_bench_press',
          sets: [
            { weightKg: 40, reps: 30 },
            { weightKg: 60, reps: 8 },
          ],
        },
      ]),
    ];

    expect(strengthByExercise(sessions)[0].totalSets).toBe(1);
  });

  it('puts the movements you actually train first', () => {
    const sessions = [
      session('2026-06-01', [
        { exerciseId: 'lateral_raise', sets: [{ weightKg: 10, reps: 12 }] },
        {
          exerciseId: 'barbell_bench_press',
          sets: [
            { weightKg: 60, reps: 8 },
            { weightKg: 60, reps: 8 },
            { weightKg: 60, reps: 8 },
          ],
        },
      ]),
    ];

    expect(strengthByExercise(sessions)[0].exerciseId).toBe('barbell_bench_press');
  });

  it('has nothing to say about a history with no training in it', () => {
    expect(strengthByExercise([])).toEqual([]);
    expect(summariseStrength([]).headline).toMatch(/few more weeks/i);
  });
});

describe('summarising the whole record', () => {
  const sessions = [
    bench('2026-06-01', 60),
    bench('2026-06-08', 62.5),
    bench('2026-06-15', 65),
    bench('2026-06-22', 70),
    session('2026-06-22', [{ exerciseId: 'lateral_raise', sets: [{ weightKg: 10, reps: 12 }] }]),
  ];

  it('separates what has a trend from what is too new to judge', () => {
    const summary = summariseStrength(sessions);

    expect(summary.moving.map((entry) => entry.exerciseId)).toContain('barbell_bench_press');
    expect(summary.tooEarly.map((entry) => entry.exerciseId)).toContain('lateral_raise');
    expect(summary.totalAddedKg).toBeGreaterThan(0);
    expect(summary.headline).toMatch(/kg added/);
  });

  it('never counts a regression as progress in the total', () => {
    const declining = [bench('2026-06-01', 80), bench('2026-06-08', 75), bench('2026-06-22', 70)];

    expect(summariseStrength(declining).totalAddedKg).toBe(0);
  });
});

describe('what to reach for next time', () => {
  it('adds one increment rather than extrapolating the observed rate', () => {
    // Someone adding 3 kg a week for six weeks will not keep doing that, and
    // prescribing as if they will is how a plan stops being followable.
    const [entry] = strengthByExercise([
      bench('2026-06-01', 60),
      bench('2026-06-08', 65),
      bench('2026-06-15', 70),
      bench('2026-06-22', 75),
    ]);

    const target = nextTarget(entry);

    expect(target.weightKg).toBe(77.5);
    expect(target.reps).toBe(entry.current.reps);
    expect(target.reason).toMatch(/since you started/i);
  });

  it('falls back to naming last time when there is no trend yet', () => {
    const [entry] = strengthByExercise([bench('2026-06-01', 60)]);

    expect(nextTarget(entry).reason).toMatch(/last time/i);
  });
});

describe('noticing a lift that has stopped moving', () => {
  it('calls it stuck after three weeks with no new best', () => {
    const stuck = [
      bench('2026-06-01', 60),
      bench('2026-06-08', 70),
      bench('2026-06-15', 70),
      bench('2026-06-22', 70),
      bench('2026-06-29', 70),
    ];

    const [stall] = stalls(stuck);

    expect(stall).toBeDefined();
    expect(stall.exerciseId).toBe('barbell_bench_press');
    expect(stall.weeks).toBeGreaterThanOrEqual(STALL_WEEKS);
    // The answer is a deload, not more effort: adding work to something
    // already stuck is the instinct and the wrong one.
    expect(stall.deloadKg).toBeLessThan(70);
    expect(stall.detail).toMatch(/let the fatigue clear/i);
  });

  it('stays quiet while the lift is still climbing', () => {
    const climbing = [
      bench('2026-06-01', 60),
      bench('2026-06-08', 62.5),
      bench('2026-06-15', 65),
      bench('2026-06-22', 67.5),
    ];

    expect(stalls(climbing)).toEqual([]);
  });

  it('stays quiet after one flat week, which is a bad day and not a wall', () => {
    const wobble = [bench('2026-06-01', 60), bench('2026-06-08', 65), bench('2026-06-15', 65)];

    expect(stalls(wobble)).toEqual([]);
  });

  it('needs enough weeks on record before it judges anything', () => {
    expect(stalls([bench('2026-06-01', 60), bench('2026-06-08', 60)])).toEqual([]);
  });

  it('rounds the deload to a weight a gym has', () => {
    const stuck = [
      bench('2026-06-01', 82.5),
      bench('2026-06-08', 82.5),
      bench('2026-06-15', 82.5),
      bench('2026-06-22', 82.5),
    ];

    expect(stalls(stuck)[0].deloadKg % 2.5).toBeCloseTo(0, 5);
  });
});
