import { describe, expect, it } from 'vitest';

import { rankMuscles, rankingHeadline, relativeStrength, type LiftMax } from '@/domain/training/muscleRanking';

const balanced: LiftMax[] = [
  { exerciseId: 'barbell_bench_press', oneRepMaxKg: 100 },
  { exerciseId: 'overhead_press', oneRepMaxKg: 64 },
  { exerciseId: 'barbell_row', oneRepMaxKg: 92 },
  { exerciseId: 'back_squat', oneRepMaxKg: 140 },
  { exerciseId: 'deadlift', oneRepMaxKg: 165 },
];

const input = { bodyWeightKg: 80, sex: 'male' as const };

describe('muscle ranking', () => {
  it('makes lifts comparable to each other, not to kilos', () => {
    // 100 kg of bench and 140 kg of squat are the same achievement for an
    // 80 kg man. Without normalising, every ranking says "your legs are
    // strongest", which is true of everyone and useful to no one.
    const bench = relativeStrength(balanced[0], 80, 'male')!;
    const squat = relativeStrength(balanced[3], 80, 'male')!;
    expect(Math.abs(bench.relative - squat.relative)).toBeLessThan(0.1);
  });

  it('finds a lagging press behind a strong bench', () => {
    const ranking = rankMuscles({
      ...input,
      lifts: [
        { exerciseId: 'barbell_bench_press', oneRepMaxKg: 120 },
        { exerciseId: 'overhead_press', oneRepMaxKg: 50 },
        { exerciseId: 'barbell_row', oneRepMaxKg: 108 },
      ],
    });

    const shoulders = ranking.imbalances.find((entry) => entry.lagging === 'shoulders');
    expect(shoulders).toBeDefined();
    expect(shoulders!.reference).toBe('chest');
    expect(shoulders!.ratio).toBeLessThan(shoulders!.expected);
    expect(shoulders!.action).toBeTruthy();
  });

  it('says nothing when the lifts are in step', () => {
    const ranking = rankMuscles({ ...input, lifts: balanced });
    expect(ranking.imbalances).toHaveLength(0);
    expect(rankingHeadline(ranking)).toContain('Nothing is badly out of step');
  });

  it('leads with the worst gap, not the first one found', () => {
    const ranking = rankMuscles({
      ...input,
      lifts: [
        { exerciseId: 'barbell_bench_press', oneRepMaxKg: 120 },
        { exerciseId: 'overhead_press', oneRepMaxKg: 55 }, // mildly behind
        { exerciseId: 'lat_pulldown', oneRepMaxKg: 55 }, // badly behind
      ],
    });

    expect(ranking.imbalances.length).toBeGreaterThan(1);
    const gaps = ranking.imbalances.map((entry) => entry.ratio / entry.expected);
    expect(gaps[0]).toBeLessThanOrEqual(gaps[1]);
  });

  it('does not pretend to know from one machine', () => {
    const ranking = rankMuscles({
      ...input,
      lifts: [{ exerciseId: 'leg_press', oneRepMaxKg: 200 }],
    });

    expect(ranking.thin).toBe(true);
    expect(rankingHeadline(ranking)).toContain('Test a couple more');
    // A sled angle changes a leg press by more than a person does.
    expect(ranking.scores.every((score) => score.confidence === 'low')).toBe(true);
  });

  it('ranks a muscle from every lift that loads it', () => {
    const ranking = rankMuscles({ ...input, lifts: balanced });
    const muscles = ranking.scores.map((score) => score.muscle);
    expect(muscles).toContain('chest');
    expect(muscles).toContain('back');
    expect(muscles).toContain('triceps'); // secondary on the bench and press
    expect(ranking.strongest[0].relative).toBeGreaterThanOrEqual(
      ranking.weakest[0].relative,
    );
  });

  it('scales the standards by sex rather than assuming one', () => {
    const lift: LiftMax = { exerciseId: 'barbell_bench_press', oneRepMaxKg: 60 };
    const woman = relativeStrength(lift, 65, 'female')!.relative;
    const man = relativeStrength(lift, 65, 'male')!.relative;
    const unknown = relativeStrength(lift, 65, 'unspecified')!.relative;

    expect(woman).toBeGreaterThan(man);
    expect(unknown).toBeGreaterThan(man);
    expect(unknown).toBeLessThan(woman);
  });

  it('ignores lifts it has no standard for rather than inventing one', () => {
    const ranking = rankMuscles({
      ...input,
      lifts: [...balanced, { exerciseId: 'face_pull', oneRepMaxKg: 40 }],
    });
    expect(ranking.scores.flatMap((score) => score.from)).not.toContain('face_pull');
  });
});
