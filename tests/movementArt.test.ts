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

  it('covers all but the one that could not be drawn correctly', () => {
    // Everything in the library has a render except `trap_bar_deadlift`, where
    // the generator kept producing a straight barbell instead of a hexagonal
    // frame. A picture showing the wrong equipment teaches the wrong thing
    // more effectively than no picture, so that one keeps the diagram.
    const keys = new Set(artKeys());
    const missing = EXERCISES.map((exercise) => exercise.id).filter((id) => !keys.has(id));

    expect(missing).toEqual(['trap_bar_deadlift']);
  });

  it('keeps the diagram fallback working for anything unrendered', () => {
    // The fallback is not vestigial while a real exercise still relies on it.
    expect(artKeys()).not.toContain('trap_bar_deadlift');
  });
});
