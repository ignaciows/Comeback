import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { WARMUP_BY_EXERCISE, WARMUP_BY_PATTERN } from '@/data/warmupProtocols';

/**
 * Read off disk rather than through `warmupArt.ts`, because the bundler
 * resolves those `require` calls and the test runner cannot.
 */
const artKeys = () =>
  readFileSync(resolve(__dirname, '../src/features/training/warmupArt.ts'), 'utf8')
    .split('\n')
    .flatMap((line) => line.match(/^\s{2}([a-z_]+):\s*require/)?.[1] ?? []);

const drillIds = () =>
  new Set(
    [...Object.values(WARMUP_BY_PATTERN), ...Object.values(WARMUP_BY_EXERCISE)]
      .flat()
      .map((drill) => drill.id),
  );

describe('warm-up drill art', () => {
  it('has a picture for every drill the app can prescribe', () => {
    // The drills need pictures more than the lifts do: nobody arrives already
    // knowing what a 90/90 is, and a name plus one line is not enough to
    // attempt a movement you have never seen. A drill without one is a drill
    // people skip.
    const keys = new Set(artKeys());

    for (const id of drillIds()) {
      expect(keys.has(id), `no art for drill ${id}`).toBe(true);
    }
  });

  it('has a file on disk for every id it claims', () => {
    for (const key of artKeys()) {
      const path = resolve(__dirname, `../assets/warmups/${key}.png`);
      expect(existsSync(path), `${key}.png is missing`).toBe(true);
    }
  });

  it('claims no art for a drill that does not exist', () => {
    // A render keyed to a typo would never show and nothing would report it.
    const ids = drillIds();

    for (const key of artKeys()) {
      expect(ids.has(key), `${key} is not a drill id`).toBe(true);
    }
  });
});
