import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FAT_STEPS,
  bodyMilestones,
  buildClassFor,
  fatStepFor,
  phaseBodies,
  wireframeKey,
  type WireframeKey,
} from '@/domain/body/wireframe';
import type { PlanPhaseView } from '@/domain/plan/phases';

/**
 * The assets are checked on disk rather than through `bodyArt.ts`, because the
 * bundler resolves those `require` calls and the test runner cannot. Reading
 * the files is the stronger check anyway: it proves the PNG is actually there,
 * not merely that a key was typed into a map.
 */
const ASSETS = resolve(__dirname, '../assets/bodies');
const hasAsset = (key: string) => existsSync(resolve(ASSETS, `${key}.png`));
const artKeys = () =>
  readFileSync(resolve(__dirname, '../src/features/body/bodyArt.ts'), 'utf8')
    .split('\n')
    .flatMap((line) => line.match(/^\s{2}([a-z]+_\d+):/)?.[1] ?? []);

const phase = (index: number, leanChangeKg: number, fatChangeKg: number): PlanPhaseView => ({
  index,
  label: leanChangeKg > 0 ? 'Build' : 'Cut',
  strategy: leanChangeKg > 0 ? 'lean_bulk' : 'cut',
  startsOn: '2026-01-01',
  endsOn: '2026-03-01',
  days: 60,
  daysDone: 0,
  sessionsDone: 0,
  weightChangeKg: leanChangeKg + fatChangeKg,
  leanChangeKg,
  fatChangeKg,
  kcal: 2600,
  story: '',
  state: 'ahead',
});

describe('choosing a body wireframe', () => {
  it('reads build off lean mass, not off the scale', () => {
    // The distinction the picture has to get right: weight alone cannot tell a
    // broad frame from a soft one.
    expect(buildClassFor(16)).toBe('slim');
    expect(buildClassFor(19.5)).toBe('medium');
    expect(buildClassFor(23)).toBe('broad');
  });

  it('uses the same band edges the body copy already quotes', () => {
    // composition.ts narrates <18 untrained, <20 visibly trained, <22 well
    // developed. A picture that disagreed with the sentence under it would be
    // the app contradicting itself on one screen.
    expect(buildClassFor(17.9)).toBe('slim');
    expect(buildClassFor(18)).toBe('medium');
    expect(buildClassFor(20.9)).toBe('medium');
    expect(buildClassFor(21)).toBe('broad');
  });

  it('snaps body fat to the nearest rendered step', () => {
    expect(fatStepFor(10)).toBe(10);
    expect(fatStepFor(12)).toBe(10);
    expect(fatStepFor(13)).toBe(15);
    expect(fatStepFor(18.7)).toBe(20);
    expect(fatStepFor(24)).toBe(25);
  });

  it('clamps to the ends rather than falling off the grid', () => {
    // Someone at 4 % or 40 % still gets a picture. The nearest is not accurate
    // for them, but a blank cell is worse and the number beside it is exact.
    expect(fatStepFor(3)).toBe(10);
    expect(fatStepFor(45)).toBe(25);
  });

  it('has a rendered asset for every key it can produce', () => {
    // The failure this prevents ships silently: a computed key with no asset
    // bundles nothing and only breaks on the device.
    for (const build of [14, 19, 24]) {
      for (const fat of FAT_STEPS) {
        const key = wireframeKey(build, fat);
        expect(hasAsset(key), `${key}.png is missing`).toBe(true);
        expect(artKeys(), key).toContain(key);
      }
    }
    expect(artKeys()).toHaveLength(12);
  });
});

describe('the body at each phase of the plan', () => {
  const input = { weightKg: 82, bodyFatPercent: 18.7, heightCm: 185 };

  it('starts from where you are, marked as today', () => {
    const bodies = phaseBodies({ ...input, phases: [phase(0, 2, -1)] });

    expect(bodies[0].isToday).toBe(true);
    expect(bodies[0].weightKg).toBe(82);
    expect(bodies[0].bodyFatPercent).toBe(18.7);
  });

  it('tracks lean and fat separately, so weight can rise while body fat falls', () => {
    // The exact thing people find hard to believe, and the reason the picture
    // exists. Reading a percentage off the scale weight could never show it.
    const bodies = phaseBodies({ ...input, phases: [phase(0, 3, -1)] });
    const after = bodies[1];

    expect(after.weightKg).toBeGreaterThan(82);
    expect(after.bodyFatPercent).toBeLessThan(18.7);
  });

  it('lets a long enough plan move you to a different build', () => {
    // Watching your own silhouette change build over two years is the point,
    // so FFMI is recomputed at each step rather than fixed at the start.
    // 60 kg at 15 % and 178 cm is FFMI ~16.2 — genuinely the untrained band.
    // (68 kg there is already 18.4, which is medium before the plan starts.)
    const bodies = phaseBodies({
      weightKg: 60,
      bodyFatPercent: 15,
      heightCm: 178,
      phases: [phase(0, 6, 1), phase(1, 6, 1)],
    });

    expect(bodies[0].key.startsWith('slim')).toBe(true);
    expect(bodies[bodies.length - 1].key.startsWith('slim')).toBe(false);
  });

  it('cuts a long plan down to three milestones', () => {
    // Eight silhouettes across two years mostly look identical; only points far
    // enough apart show the change.
    const phases = [0, 1, 2, 3, 4, 5, 6].map((index) => phase(index, 1.5, -0.5));
    const milestones = bodyMilestones({ ...input, phases });

    expect(milestones).toHaveLength(3);
    expect(milestones[0].isToday).toBe(true);
    expect(milestones[2].phaseIndex).toBe(6);
  });

  it('keeps a short plan whole rather than padding it to three', () => {
    const milestones = bodyMilestones({ ...input, phases: [phase(0, 2, -1)] });

    expect(milestones).toHaveLength(2);
  });

  it('never produces a key with no asset, on any plausible plan', () => {
    const keys = new Set<WireframeKey>();
    for (const start of [8, 15, 22, 32]) {
      for (const height of [160, 178, 195]) {
        const bodies = phaseBodies({
          weightKg: 90,
          bodyFatPercent: start,
          heightCm: height,
          phases: [phase(0, 4, -6), phase(1, 3, 2), phase(2, 1, -5)],
        });
        for (const body of bodies) keys.add(body.key);
      }
    }

    expect(keys.size).toBeGreaterThan(1);
    for (const key of keys) {
      expect(hasAsset(key), `${key}.png is missing`).toBe(true);
      expect(artKeys(), key).toContain(key);
    }
  });
});
