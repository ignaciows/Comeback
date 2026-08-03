import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { EXERCISES } from '@/data/exercises';

/**
 * Read as source rather than imported.
 *
 * `exerciseArt.ts` is a table of `require('…webp')` calls, which only resolve
 * under Metro — importing it here is a syntax error. The risks worth guarding
 * do not need the images though: a key that is not a real exercise id, and a
 * fallback pointing at a slot with no art. Both fail silently in the app,
 * because a missed lookup just renders nothing at all.
 */
const SOURCE = readFileSync(new URL('../src/features/training/exerciseArt.ts', import.meta.url), 'utf8');

const artIds = [...SOURCE.matchAll(/^ {2}(\w+): require\(/gm)].map((match) => match[1]);
const fallbacks = [...SOURCE.matchAll(/^ {2}(\w+): '(\w+)',$/gm)].map((match) => ({
  from: match[1],
  to: match[2],
}));

describe('exercise art', () => {
  it('parses the table it is checking', () => {
    // If the shape of the file changes, every other test here quietly passes
    // on an empty list. This is the tripwire for that.
    expect(artIds.length).toBeGreaterThan(5);
    expect(fallbacks.length).toBeGreaterThan(5);
  });

  it('only names exercises that exist', () => {
    const known = new Set(EXERCISES.map((exercise) => exercise.id));
    for (const id of artIds) {
      expect(known.has(id), `${id} has art but is not in the catalogue`).toBe(true);
    }
    for (const entry of fallbacks) {
      expect(known.has(entry.from), `${entry.from} falls back but is not in the catalogue`).toBe(true);
    }
  });

  it('never borrows from a movement that has no art itself', () => {
    const owned = new Set(artIds);
    for (const entry of fallbacks) {
      // A fallback pointing at an empty slot counts as covered and shows
      // nothing, which is the worst of both.
      expect(owned.has(entry.to), `${entry.from} borrows from ${entry.to}, which has no render`).toBe(true);
    }
  });

  it('does not let an exercise both own art and borrow it', () => {
    for (const entry of fallbacks) {
      expect(entry.from).not.toBe(entry.to);
      expect(artIds, `${entry.from} has its own art and a fallback`).not.toContain(entry.from);
    }
  });

  it('keeps coverage from regressing', () => {
    const covered = new Set([...artIds, ...fallbacks.map((entry) => entry.from)]);
    expect(covered.size).toBeGreaterThanOrEqual(35);
  });
});
