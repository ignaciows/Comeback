import { describe, expect, it } from 'vitest';

import { buildWarmup, warmupSummary } from '@/domain/training/warmup';

describe('warm-up', () => {
  it('is about ten minutes, never forty', () => {
    const heavy = buildWarmup({
      exercises: [
        { exerciseId: 'back_squat', workingWeightKg: 120 },
        { exerciseId: 'romanian_deadlift', workingWeightKg: 90 },
        { exerciseId: 'leg_press', workingWeightKg: 200 },
        { exerciseId: 'lateral_raise', workingWeightKg: 12 },
      ],
    });

    expect(heavy.minutes).toBeGreaterThanOrEqual(5);
    expect(heavy.minutes).toBeLessThanOrEqual(12);
  });

  it('prepares the patterns today actually has', () => {
    const push = buildWarmup({ exercises: [{ exerciseId: 'barbell_bench_press', workingWeightKg: 80 }] });
    const legs = buildWarmup({ exercises: [{ exerciseId: 'back_squat', workingWeightKg: 100 }] });

    expect(push.patterns).toContain('horizontal_push');
    expect(legs.patterns).toContain('squat');

    // A press day has no business warming up ankles for squats it will not do.
    const pushDrills = push.steps.filter((step) => step.phase === 'mobilise').map((step) => step.id);
    expect(pushDrills).not.toContain('ankle_rock');
    expect(legs.steps.filter((step) => step.phase === 'mobilise').map((step) => step.id)).toContain('ankle_rock');
  });

  it('caps mobility so the warm-up does not become the session', () => {
    const everything = buildWarmup({
      exercises: [
        { exerciseId: 'back_squat', workingWeightKg: 100 },
        { exerciseId: 'romanian_deadlift', workingWeightKg: 80 },
        { exerciseId: 'barbell_bench_press', workingWeightKg: 70 },
        { exerciseId: 'pull_up', workingWeightKg: null },
        { exerciseId: 'overhead_press', workingWeightKg: 45 },
      ],
    });

    expect(everything.steps.filter((step) => step.phase === 'mobilise').length).toBeLessThanOrEqual(3);
  });

  it('ramps into the first lift with real weights', () => {
    const warmup = buildWarmup({ exercises: [{ exerciseId: 'back_squat', workingWeightKg: 100 }] });
    const ramp = warmup.steps.filter((step) => step.phase === 'ramp');

    expect(ramp.length).toBe(3);
    for (const step of ramp) {
      expect(step.prescription).toMatch(/\d+ reps @ \d+(\.\d+)? kg/);
      expect(step.exerciseId).toBe('back_squat');
    }

    // The ramp climbs. A flat ramp is three extra working sets.
    const weights = ramp.map((step) => Number(step.prescription.match(/@ ([\d.]+) kg/)?.[1]));
    expect(weights[0]).toBeLessThan(weights[1]);
    expect(weights[1]).toBeLessThan(weights[2]);
    expect(weights[2]).toBeLessThan(100);
  });

  it('does not invent a ramp for isolation work', () => {
    const warmup = buildWarmup({ exercises: [{ exerciseId: 'lateral_raise', workingWeightKg: 12 }] });
    expect(warmup.steps.filter((step) => step.phase === 'ramp')).toHaveLength(0);
  });

  it('always raises first, whatever the session is', () => {
    const warmup = buildWarmup({ exercises: [] });
    expect(warmup.steps[0].phase).toBe('raise');
    expect(warmupSummary(warmup)).toContain('min');
  });

  it('never prescribes a static stretch before lifting', () => {
    const warmup = buildWarmup({
      exercises: [
        { exerciseId: 'back_squat', workingWeightKg: 100 },
        { exerciseId: 'barbell_bench_press', workingWeightKg: 80 },
      ],
    });

    // Held stretches cost force output for up to an hour (Simic 2013). Every
    // drill here has to be something you move through.
    for (const step of warmup.steps.filter((entry) => entry.phase === 'mobilise')) {
      expect(step.prescription).not.toMatch(/hold/i);
    }
  });
});
