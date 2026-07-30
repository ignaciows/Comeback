import { describe, expect, it } from 'vitest';

import { COACHING_CUES, cuesFor } from '@/data/coachingCues';
import { EXERCISES, getExercise } from '@/data/exercises';
import { TARGET_RIR, cueForSet, restForSet, suggestLoad, warmupSets } from '@/domain/training/coaching';
import type { WorkoutSet } from '@/domain/types';

const set = (patch: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: 's',
  order: 0,
  weightKg: 60,
  reps: 8,
  rir: TARGET_RIR,
  warmup: false,
  completed: true,
  completedAt: '2026-06-01T18:00:00.000Z',
  ...patch,
});

const bench = { exerciseId: 'barbell_bench_press', repMin: 6, repMax: 10 };

describe('picking the load for the next set', () => {
  it('goes up when the last set had reps to spare', () => {
    const suggestion = suggestLoad({
      ...bench,
      lastSet: set({ rir: TARGET_RIR + 2 }),
      setsThisSession: [],
      previousBest: null,
    });

    expect(suggestion.kind).toBe('heavier');
    expect(suggestion.weightKg).toBeGreaterThan(60);
    expect(suggestion.reason).toMatch(/tank/i);
  });

  it('comes down when the last set was at failure', () => {
    const suggestion = suggestLoad({
      ...bench,
      lastSet: set({ rir: 0 }),
      setsThisSession: [],
      previousBest: null,
    });

    expect(suggestion.kind).toBe('lighter');
    expect(suggestion.weightKg).toBeLessThan(60);
  });

  it('repeats the reps you actually did, not the middle of the range', () => {
    // Otherwise every set of a workout starts by making you re-type the same
    // number, which is the most-used screen in the app.
    const suggestion = suggestLoad({
      ...bench,
      lastSet: set({ reps: 10, rir: TARGET_RIR }),
      setsThisSession: [],
      previousBest: null,
    });

    expect(suggestion.kind).toBe('same');
    expect(suggestion.reps).toBe(10);
  });

  it('holds when the last set landed on target', () => {
    const suggestion = suggestLoad({
      ...bench,
      lastSet: set({ rir: TARGET_RIR }),
      setsThisSession: [],
      previousBest: null,
    });

    expect(suggestion.kind).toBe('same');
    expect(suggestion.weightKg).toBe(60);
  });

  it('falls back to the rep range when no effort was recorded', () => {
    const tooEasy = suggestLoad({
      ...bench,
      lastSet: set({ rir: null, reps: 14 }),
      setsThisSession: [],
      previousBest: null,
    });
    expect(tooEasy.kind).toBe('heavier');

    const tooHard = suggestLoad({
      ...bench,
      lastSet: set({ rir: null, reps: 4 }),
      setsThisSession: [],
      previousBest: null,
    });
    expect(tooHard.kind).toBe('lighter');
  });

  it('adds load between sessions only once the top of the range is earned', () => {
    const earned = suggestLoad({
      ...bench,
      lastSet: null,
      setsThisSession: [],
      previousBest: { weightKg: 60, reps: 10 },
    });
    expect(earned.kind).toBe('heavier');
    expect(earned.reps).toBe(bench.repMin);

    const notYet = suggestLoad({
      ...bench,
      lastSet: null,
      setsThisSession: [],
      previousBest: { weightKg: 60, reps: 8 },
    });
    expect(notYet.kind).toBe('same');
    expect(notYet.weightKg).toBe(60);
    // Same weight, one more rep — that is the other half of double progression.
    expect(notYet.reps).toBe(9);
  });

  it('suggests no weight at all the first time, rather than inventing one', () => {
    const first = suggestLoad({ ...bench, lastSet: null, setsThisSession: [], previousBest: null });

    expect(first.kind).toBe('first_time');
    expect(first.weightKg).toBeNull();
    expect(first.reason).toBeNull();
  });

  it('rounds to something a gym actually has', () => {
    const suggestion = suggestLoad({
      ...bench,
      lastSet: set({ weightKg: 61.3, rir: TARGET_RIR + 2 }),
      setsThisSession: [],
      previousBest: null,
    });

    // Nobody can load 63.8 kg. Whole increments only.
    expect((suggestion.weightKg as number) % 2.5).toBeCloseTo(0, 5);
  });

  it('never suggests a negative or zero load', () => {
    const suggestion = suggestLoad({
      ...bench,
      lastSet: set({ weightKg: 2, rir: 0 }),
      setsThisSession: [],
      previousBest: null,
    });

    expect(suggestion.weightKg).toBeGreaterThan(0);
  });
});

describe('warming up', () => {
  it('ramps to the working weight on a compound', () => {
    const ramp = warmupSets('barbell_bench_press', 80);

    expect(ramp.length).toBeGreaterThan(1);
    expect(ramp[0].weightKg).toBeLessThan(ramp[ramp.length - 1].weightKg);
    expect(ramp[ramp.length - 1].weightKg).toBeLessThan(80);
    // Reps come down as the weight goes up.
    expect(ramp[0].reps).toBeGreaterThan(ramp[ramp.length - 1].reps);
  });

  it('does not bother for isolation work or light loads', () => {
    expect(warmupSets('lateral_raise', 12)).toEqual([]);
    expect(warmupSets('barbell_bench_press', 20)).toEqual([]);
    expect(warmupSets('barbell_bench_press', null)).toEqual([]);
  });
});

describe('what to say during the set', () => {
  it('leads with safety on the first set and drops it after', () => {
    const cues = cuesFor('back_squat', 'squat');
    const first = cueForSet('back_squat', 0, cues);
    const later = cueForSet('back_squat', 1, cues);

    expect(first?.focus).toBe('safety');
    expect(later?.focus).not.toBe('safety');
  });

  it('gives compounds an external focus and isolation an internal one', () => {
    // Force and skill respond to attention on the effect of the movement;
    // growth in a single muscle responds to attention on the muscle.
    const squat = cueForSet('back_squat', 1, cuesFor('back_squat', 'squat'));
    const curl = cueForSet('dumbbell_curl', 0, cuesFor('dumbbell_curl', 'isolation'));

    expect(getExercise('back_squat')?.isCompound).toBe(true);
    expect(squat?.focus).toBe('external');
    expect(getExercise('dumbbell_curl')?.isCompound).toBe(false);
    expect(curl?.focus).toBe('internal');
  });

  it('says one thing, never a list', () => {
    const cue = cueForSet('barbell_bench_press', 1, cuesFor('barbell_bench_press', 'horizontal_push'));

    expect(cue).not.toBeNull();
    // A cue that needs a second sentence is a cue that will not land mid-set.
    expect(cue!.text.split(/[.!?]/).filter((part) => part.trim().length > 0)).toHaveLength(1);
    expect(cue!.text.length).toBeLessThan(90);
  });

  it('rotates rather than repeating the same line every set', () => {
    const cues = cuesFor('lat_pulldown', 'vertical_pull');
    const seen = [0, 1, 2].map((index) => cueForSet('lat_pulldown', index, cues)?.text);

    expect(new Set(seen).size).toBeGreaterThan(1);
  });

  it('falls back to the movement pattern rather than saying nothing', () => {
    const cues = cuesFor('an_exercise_with_no_entry', 'hinge');

    expect(cues.length).toBeGreaterThan(0);
    expect(cueForSet('an_exercise_with_no_entry', 0, cues)).not.toBeNull();
  });

  it('has cues for every exercise the routines actually use', () => {
    // A missing entry is not fatal — the pattern covers it — but the movements
    // a beginner meets first should have their own words.
    const staples = [
      'barbell_bench_press',
      'back_squat',
      'deadlift',
      'lat_pulldown',
      'overhead_press',
      'barbell_row',
      'romanian_deadlift',
      'dumbbell_curl',
      'triceps_pushdown',
      'lateral_raise',
    ];

    for (const id of staples) {
      expect(COACHING_CUES[id], `no cues for ${id}`).toBeDefined();
    }
  });

  it('only names exercises that exist', () => {
    const known = new Set(EXERCISES.map((exercise) => exercise.id));
    for (const id of Object.keys(COACHING_CUES)) {
      expect(known.has(id), `${id} is not in the exercise catalogue`).toBe(true);
    }
  });
});

describe('rest', () => {
  it('gives a compound longer than an isolation movement', () => {
    expect(restForSet('back_squat', false)).toBeGreaterThan(restForSet('lateral_raise', false));
  });

  it('cuts it short after the last set, since the next exercise is different', () => {
    expect(restForSet('back_squat', true)).toBeLessThan(restForSet('back_squat', false));
  });
});
