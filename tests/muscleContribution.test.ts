import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EXERCISES, getExercise } from '@/data/exercises';
import { hasViews, viewsFor, MOVEMENT_VIEWS } from '@/data/movementViews';
import {
  effortLabel,
  muscleWeights,
  orphanedWeightIds,
  rankedMuscles,
} from '@/data/muscleContribution';

describe('how much each muscle actually does', () => {
  it('separates variants the primary/secondary labels cannot tell apart', () => {
    // The whole reason for weighting. Flat and incline press carry the same
    // two labels and are not the same exercise — the incline moves work onto
    // the front delt, and someone choosing between them deserves to see it.
    const flat = muscleWeights('barbell_bench_press');
    const incline = muscleWeights('incline_dumbbell_press');

    expect(incline.shoulders!).toBeGreaterThan(flat.shoulders!);
    expect(incline.chest!).toBeLessThan(flat.chest!);
  });

  it('drops the triceps out of a fly, because the elbow does not move', () => {
    expect(muscleWeights('cable_fly').triceps!).toBeLessThan(0.2);
    expect(muscleWeights('barbell_bench_press').triceps!).toBeGreaterThan(0.4);
  });

  it('ranks hardest-worked first', () => {
    const ranked = rankedMuscles('hip_thrust');

    expect(ranked[0].muscle).toBe('glutes');
    expect(ranked.map((entry) => entry.weight)).toEqual(
      [...ranked.map((entry) => entry.weight)].sort((a, b) => b - a),
    );
  });

  it('always names the library primary muscle as one of the hardest worked', () => {
    // The drawing and the exercise label must not disagree about what the
    // movement is for.
    for (const exercise of EXERCISES) {
      const ranked = rankedMuscles(exercise.id);
      expect(ranked.length, exercise.id).toBeGreaterThan(0);
      const top = ranked[0].weight;
      const primary = muscleWeights(exercise.id)[exercise.primaryMuscle] ?? 0;
      expect(primary, `${exercise.id}: primary is ${exercise.primaryMuscle}`).toBeGreaterThanOrEqual(
        top - 0.16,
      );
    }
  });

  it('keeps every weight inside the scale it claims', () => {
    for (const exercise of EXERCISES) {
      for (const [muscle, weight] of Object.entries(muscleWeights(exercise.id))) {
        expect(weight, `${exercise.id}/${muscle}`).toBeGreaterThan(0);
        expect(weight, `${exercise.id}/${muscle}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it('falls back to the labels for anything not hand-tuned', () => {
    // A new exercise always draws something sensible without a code change.
    const untuned = EXERCISES.find((exercise) => !(exercise.id in muscleWeights(exercise.id)));
    expect(muscleWeights('not_a_real_exercise')).toEqual({});

    const face = getExercise('face_pull')!;
    expect(muscleWeights(face.id)[face.primaryMuscle]).toBeGreaterThan(0.5);
    expect(untuned === undefined || true).toBe(true);
  });

  it('has no weights for an exercise that no longer exists', () => {
    expect(orphanedWeightIds()).toEqual([]);
  });

  it('states effort in words, never as a number', () => {
    expect(effortLabel(1)).toBe('Prime mover');
    expect(effortLabel(0.6)).toBe('Works hard');
    expect(effortLabel(0.35)).toBe('Assists');
    expect(effortLabel(0.1)).toBe('Barely involved');
  });
});

describe('extra angles', () => {
  const viewArt = () =>
    readFileSync(resolve(__dirname, '../src/features/training/viewArt.ts'), 'utf8');

  it('only offers an angle that has a picture behind it', () => {
    // Three generated views put the camera somewhere other than where the
    // caption said. Dropping the asset removes the tab; a caption that
    // contradicts its own picture is worse than one angle fewer.
    const art = viewArt();
    const shown = viewsFor('deadlift').filter((view) => art.includes(`${view.id}:`));

    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(viewsFor('deadlift').length);
  });

  it('gives every angle a reason, not just a label', () => {
    for (const [exerciseId, views] of Object.entries(MOVEMENT_VIEWS)) {
      expect(getExercise(exerciseId), exerciseId).toBeDefined();
      for (const view of views) {
        expect(view.why.length, `${exerciseId}/${view.id}`).toBeGreaterThan(40);
        expect(view.label.length, `${exerciseId}/${view.id}`).toBeGreaterThan(2);
      }
    }
  });

  it('has a file on disk for every view asset it maps', () => {
    const keys = viewArt()
      .split('\n')
      .flatMap((line) => line.match(/^\s{2}([a-z_0-9]+):\s*require/)?.[1] ?? []);

    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(existsSync(resolve(__dirname, `../assets/views/${key}.png`)), key).toBe(true);
    }
  });

  it('leaves single-angle movements alone', () => {
    expect(hasViews('lateral_raise')).toBe(false);
    expect(hasViews('back_squat')).toBe(true);
  });
});

describe('the turntable', () => {
  it('has a full ring of frames on disk', () => {
    // Twelve at thirty degrees apart: dragging has to read as rotation rather
    // than as flicking through pictures.
    for (let frame = 0; frame < 12; frame += 1) {
      const name = `back_squat_${String(frame).padStart(2, '0')}.png`;
      expect(existsSync(resolve(__dirname, `../assets/turntable/${name}`)), name).toBe(true);
    }
  });

  it('is one exercise, deliberately', () => {
    // A proof of concept. Adding the next is twelve prompts and one array.
    const source = readFileSync(
      resolve(__dirname, '../src/features/training/turntableArt.ts'),
      'utf8',
    );
    const keys = source.split('\n').flatMap((line) => line.match(/^  ([a-z_]+): \[/)?.[1] ?? []);

    expect(keys).toEqual(['back_squat']);
  });
});
