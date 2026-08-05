import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EXERCISES } from '@/data/exercises';

/**
 * Checked on disk rather than through `movementArt.ts`, because the bundler
 * resolves those `require` calls and the test runner cannot. Reading the file
 * proves the PNG is actually there, which is the failure worth catching: a key
 * with no asset bundles nothing and breaks only on the device.
 */
const ART_FILE = resolve(__dirname, '../src/features/training/movementArt.ts');
const artKeys = () =>
  readFileSync(ART_FILE, 'utf8')
    .split('\n')
    .flatMap((line) => line.match(/^\s{2}([a-z_]+):\s*require/)?.[1] ?? []);

describe('rendered movement art', () => {
  it('has a file on disk for every id it claims', () => {
    const keys = artKeys();

    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const path = resolve(__dirname, `../assets/movements/${key}.png`);
      expect(existsSync(path), `${key}.png is missing`).toBe(true);
    }
  });

  it('only claims exercises that exist in the library', () => {
    // A render keyed to a typo would silently never show, and the diagram
    // fallback would hide it — the exercise would just look unrendered.
    const ids = new Set(EXERCISES.map((exercise) => exercise.id));

    for (const key of artKeys()) {
      expect(ids.has(key), `${key} is not an exercise id`).toBe(true);
    }
  });

  it('covers the movements the diagram serves worst', () => {
    // These are the ones whose difficulty is entirely the setup — which
    // machine, which pad against which limb. A stick figure cannot tell a
    // seated calf raise from a leg press, and those are the ones people get
    // wrong.
    const keys = artKeys();

    for (const id of [
      'hanging_leg_raise',
      'seated_leg_curl',
      'dip',
      'standing_calf_raise',
      'seated_calf_raise',
      'cable_crunch',
      'back_extension',
      'stationary_bike',
      'incline_walk',
      'mobility_flow',
    ]) {
      expect(keys, id).toContain(id);
    }
  });

  it('leaves the rest on the diagram rather than breaking', () => {
    // The map is deliberately partial. A visual system that only works once
    // all fifty-one renders exist is broken for as long as they take to draw.
    const keys = artKeys();

    expect(keys.length).toBeLessThan(EXERCISES.length);
    expect(keys).not.toContain('barbell_bench_press');
  });
});
