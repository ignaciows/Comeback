import { describe, expect, it } from 'vitest';

import { COACH_NOTES, COACH_STAGE_ORDER, coachNotesFor } from '@/data/coachNotes';
import { EXERCISES } from '@/data/exercises';
import { cascadeSummary, coachCascade } from '@/domain/training/coachCascade';
import type { MovementPattern } from '@/domain/types';

describe('the coach cascade', () => {
  it('descends in the order the rep actually happens', () => {
    // Position, then down, then up, then what you should feel, then getting
    // better at it. A reference-book ordering would read as five unrelated
    // cards instead of one argument.
    const stages = coachCascade('barbell_bench_press');

    expect(stages.map((stage) => stage.key)).toEqual(COACH_STAGE_ORDER);
  });

  it('gives every stage a reason, which is the whole point', () => {
    // The app already said what to do. A stage without a why is the old
    // screen with a number stuck on the front of it.
    for (const exercise of EXERCISES) {
      for (const stage of coachCascade(exercise.id)) {
        expect(stage.why.length, `${exercise.id}/${stage.key}`).toBeGreaterThan(60);
        expect(stage.title.length, `${exercise.id}/${stage.key}`).toBeGreaterThan(4);
      }
    }
  });

  it('draws the body on the stage about what you should feel, and only there', () => {
    const stages = coachCascade('back_squat');
    const withMuscles = stages.filter((stage) => stage.showsMuscles);

    expect(withMuscles).toHaveLength(1);
    expect(withMuscles[0].key).toBe('focus');
    expect(withMuscles[0].primaryMuscle).toBe('quads');
  });

  it('splits the rep so each half carries its own reason', () => {
    // The first execution step is getting into the bottom position and the
    // rest is coming back out of it. Listing them whole would leave the
    // "why you go all the way down" stage with nothing under it.
    const stages = coachCascade('barbell_bench_press');
    const range = stages.find((stage) => stage.key === 'range')!;
    const drive = stages.find((stage) => stage.key === 'drive')!;

    expect(range.points.length).toBe(1);
    expect(drive.points.length).toBeGreaterThan(0);
    expect(range.points[0]).not.toBe(drive.points[0]);
  });

  it('reaches for the reasons by pattern, so presses agree with each other', () => {
    const bench = coachCascade('barbell_bench_press');
    const dumbbell = coachCascade('dumbbell_bench_press');

    expect(bench.map((s) => s.why)).toEqual(dumbbell.map((s) => s.why));
    // But the instructions under them are still per-exercise.
    expect(bench[0].points).not.toEqual(dumbbell[0].points);
  });

  it('covers every movement pattern in the library', () => {
    const patterns = new Set<MovementPattern>(EXERCISES.map((exercise) => exercise.pattern));

    for (const pattern of patterns) {
      expect(COACH_NOTES[pattern], pattern).toBeDefined();
      expect(coachNotesFor(pattern).focus.why.length).toBeGreaterThan(60);
    }
  });

  it('renders nothing for an exercise it has never heard of', () => {
    // Better an empty screen than a confident page of generic advice.
    expect(coachCascade('not_a_real_exercise')).toEqual([]);
    expect(cascadeSummary('not_a_real_exercise')).toBeNull();
  });

  it('never scolds', () => {
    // Same rule the lessons follow. A coach who blames you is one you stop
    // reading.
    const scolding = /you (should have|failed|are lazy|never bother)|stop being/i;

    for (const exercise of EXERCISES) {
      for (const stage of coachCascade(exercise.id)) {
        expect(scolding.test(stage.why), `${exercise.id}: ${stage.why}`).toBe(false);
      }
    }
  });
});
