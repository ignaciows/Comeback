import { describe, expect, it } from 'vitest';

import { EXERCISES } from '@/data/exercises';
import { WARMUP_BY_EXERCISE, WARMUP_BY_PATTERN, WARMUP_SOURCES } from '@/data/warmupProtocols';
import { MAX_DRILLS, hasWarmup, warmupForExercise, warmupMinutes } from '@/domain/training/warmup';

describe('the warm-up for a specific lift', () => {
  it('prepares shoulders before a press, not ankles', () => {
    // The whole reason the specific warm-up exists: the general one raises
    // your temperature and tells you nothing about what this lift needs.
    const drills = warmupForExercise('barbell_bench_press').map((drill) => drill.id);

    expect(drills).toContain('band_pull_apart');
    expect(drills).not.toContain('ankle_rock');
  });

  it('prepares hips and ankles before a squat, not shoulders', () => {
    const drills = warmupForExercise('back_squat').map((drill) => drill.id);

    expect(drills).toContain('ankle_rock');
    expect(drills).toContain('ninety_ninety');
    expect(drills).not.toContain('band_pull_apart');
  });

  it('gives a front squat the wrists a back squat never asks for', () => {
    // The pattern is the right level for most things and too coarse here.
    const front = warmupForExercise('front_squat').map((drill) => drill.id);
    const back = warmupForExercise('back_squat').map((drill) => drill.id);

    expect(front).toContain('wrist_prep');
    expect(back).not.toContain('wrist_prep');
  });

  it('never asks for more than four movements', () => {
    // Longer than this is a workout, and a warm-up that is a workout is one
    // people learn to tap past — including on the lifts where it matters.
    for (const exercise of EXERCISES) {
      const drills = warmupForExercise(exercise.id);
      expect(drills.length, exercise.id).toBeLessThanOrEqual(MAX_DRILLS);
    }
  });

  it('gives every compound something to do', () => {
    for (const exercise of EXERCISES.filter((entry) => entry.isCompound)) {
      expect(warmupForExercise(exercise.id).length, exercise.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('says nothing before a cable curl rather than padding it', () => {
    expect(warmupForExercise('cable_curl')).toEqual([]);
    expect(hasWarmup('cable_curl')).toBe(false);
  });

  it('has no warm-up for an exercise it has never heard of', () => {
    expect(warmupForExercise('not_a_real_exercise')).toEqual([]);
  });

  it('cites a source on every drill', () => {
    // "Nothing invented" is the rule for everything the app asserts, and a
    // movement someone is about to do with a cold joint is not the place to
    // start making exceptions.
    const all = [...Object.values(WARMUP_BY_PATTERN), ...Object.values(WARMUP_BY_EXERCISE)].flat();

    expect(all.length).toBeGreaterThan(0);
    for (const drill of all) {
      expect(drill.source, drill.id).toBeTruthy();
      expect(drill.source.length, drill.id).toBeGreaterThan(20);
      expect(drill.why, drill.id).toBeTruthy();
      expect(drill.dose, drill.id).toBeTruthy();
    }
  });

  it('keeps a drill identical wherever it appears', () => {
    // The same movement described two ways is how the app starts contradicting
    // itself; shared drill objects make that impossible rather than unlikely.
    const byId = new Map<string, string>();
    const all = [...Object.values(WARMUP_BY_PATTERN), ...Object.values(WARMUP_BY_EXERCISE)].flat();

    for (const drill of all) {
      const seen = byId.get(drill.id);
      if (seen) expect(drill.name, drill.id).toBe(seen);
      byId.set(drill.id, drill.name);
    }
  });

  it('lists the papers behind the drills', () => {
    expect(WARMUP_SOURCES.some((source) => source.includes('Simic'))).toBe(true);
    expect(WARMUP_SOURCES.some((source) => source.includes('Behm'))).toBe(true);
    expect(WARMUP_SOURCES.some((source) => source.includes('Jeffreys'))).toBe(true);
  });

  it('estimates a length short enough to be worth doing', () => {
    expect(warmupMinutes('back_squat')).toBeLessThanOrEqual(2);
    expect(warmupMinutes('cable_curl')).toBe(0);
  });
});
