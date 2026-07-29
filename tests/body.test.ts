import { describe, expect, it } from 'vitest';

import { deriveTrainingBias, remainingPotentialKg } from '@/domain/body/bodyType';
import {
  FFMI_CEILING,
  analyseComposition,
  bodyShape,
  describeDevelopment,
  frameSize,
  projectComposition,
  type BodyInput,
} from '@/domain/body/composition';

const base: BodyInput = {
  heightCm: 186,
  weightKg: 77.25,
  bodyFatPercent: 16,
  sex: 'male',
  wristCm: 17,
  experience: 'returning',
};

describe('what a body is made of', () => {
  it('splits weight into lean and fat', () => {
    const composition = analyseComposition(base);

    expect(composition.fatKg).toBeCloseTo(12.4, 1);
    expect(composition.leanKg).toBeCloseTo(64.9, 1);
    // Fat and lean are each rounded to a tenth, so the pair can sit up to a
    // tenth away from the weight they came from. That is smaller than the
    // error on the body fat reading itself and not worth carrying decimals for.
    expect(Math.abs(composition.fatKg + composition.leanKg - base.weightKg)).toBeLessThanOrEqual(0.1);
    expect(composition.estimatedFat).toBe(false);
  });

  it('normalises the mass index for height, so tall and short compare', () => {
    const tall = analyseComposition({ ...base, heightCm: 195, weightKg: 85 });
    const short = analyseComposition({ ...base, heightCm: 170, weightKg: 65 });

    // Both are the same build; the raw index would rank the short one higher.
    expect(Math.abs(tall.ffmi - short.ffmi)).toBeLessThan(2);
  });

  it('says when body fat was assumed rather than measured', () => {
    const guessed = analyseComposition({ ...base, bodyFatPercent: null });

    expect(guessed.estimatedFat).toBe(true);
    expect(guessed.bodyFatPercent).toBeGreaterThan(5);
    expect(guessed.bodyFatPercent).toBeLessThan(50);
  });

  it('spreads real bodies across the scale instead of bunching them', () => {
    // Dividing by the ceiling put every living person in the top third, which
    // made two very different builds draw almost identically.
    const skinny = analyseComposition({ ...base, weightKg: 66, bodyFatPercent: 12 });
    const built = analyseComposition({ ...base, weightKg: 88, bodyFatPercent: 11 });

    expect(built.developed - skinny.developed).toBeGreaterThan(0.3);
    expect(skinny.developed).toBeLessThan(0.3);
  });

  it('never reports past the drug-free ceiling as though it were normal', () => {
    const enormous = analyseComposition({ ...base, weightKg: 130, bodyFatPercent: 8 });
    expect(enormous.developed).toBeLessThanOrEqual(1);
    expect(describeDevelopment(enormous, 'male')).toMatch(/ceiling/i);
  });

  it('flags that the published bands are from male populations', () => {
    expect(describeDevelopment(analyseComposition(base), 'female')).toMatch(/male populations/i);
  });
});

describe('frame', () => {
  it('reads a bigger wrist as a bigger frame', () => {
    expect(frameSize(186, 19)).toBeGreaterThan(frameSize(186, 16));
  });

  it('sits in the middle when nothing was measured', () => {
    expect(frameSize(186, null)).toBe(0.5);
  });
});

describe('the shape that gets drawn', () => {
  const frame = frameSize(base.heightCm, base.wristCm);

  it('puts muscle on the shoulders and fat on the waist', () => {
    const lean = bodyShape(analyseComposition({ ...base, weightKg: 82, bodyFatPercent: 11 }), frame);
    const fat = bodyShape(analyseComposition({ ...base, weightKg: 82, bodyFatPercent: 28 }), frame);

    // Same weight, same height, completely different silhouette.
    expect(lean.shoulderWidth).toBeGreaterThan(fat.shoulderWidth);
    expect(fat.waistWidth).toBeGreaterThan(lean.waistWidth);
    expect(lean.taper).toBeGreaterThan(fat.taper);
  });

  it('widens the top when lean mass is added', () => {
    const now = analyseComposition(base);
    const later = projectComposition(base, { leanKg: 5, fatKg: 0 });

    expect(bodyShape(later, frame).shoulderWidth).toBeGreaterThan(bodyShape(now, frame).shoulderWidth);
    expect(later.ffmi).toBeGreaterThan(now.ffmi);
  });

  it('shows almost no change when the plan predicts almost none', () => {
    const now = bodyShape(analyseComposition(base), frame);
    const later = bodyShape(projectComposition(base, { leanKg: 0.2, fatKg: 0.1 }), frame);

    // The drawing must not flatter a plan that does nothing.
    expect(Math.abs(later.shoulderWidth - now.shoulderWidth)).toBeLessThan(1);
  });

  it('drops body fat when the plan takes fat off', () => {
    const later = projectComposition(base, { leanKg: 0, fatKg: -5 });
    expect(later.bodyFatPercent).toBeLessThan(analyseComposition(base).bodyFatPercent);
  });
});

describe('how much room is left', () => {
  it('offers more to someone further from the ceiling', () => {
    const untrained = analyseComposition({ ...base, weightKg: 66, bodyFatPercent: 14 });
    const advanced = analyseComposition({ ...base, weightKg: 92, bodyFatPercent: 11 });

    expect(remainingPotentialKg(untrained, base.heightCm)).toBeGreaterThan(
      remainingPotentialKg(advanced, base.heightCm),
    );
  });

  it('offers nothing once the ceiling is reached', () => {
    const atCeiling = analyseComposition({ ...base, weightKg: 110, bodyFatPercent: 8 });
    if (atCeiling.ffmi >= FFMI_CEILING) {
      expect(remainingPotentialKg(atCeiling, base.heightCm)).toBe(0);
    }
  });
});

describe('what this body should train', () => {
  const frame = frameSize(base.heightCm, base.wristCm);
  const composition = analyseComposition(base);
  const shape = bodyShape(composition, frame);

  it('sends a narrow build to the shoulders and back', () => {
    const bias = deriveTrainingBias({ composition, shape, armLength: 'average', legLength: 'average' });

    expect(bias.emphasise).toContain('shoulders');
    expect(bias.emphasise).toContain('back');
  });

  it('swaps the squat for someone with long legs, and says why', () => {
    const bias = deriveTrainingBias({ composition, shape, armLength: 'average', legLength: 'long' });
    const swap = bias.swaps.find((entry) => entry.from === 'back_squat');

    expect(swap).toBeDefined();
    expect(swap?.because).toMatch(/femur/i);
    expect(bias.emphasise).toContain('quads');
  });

  it('leaves the barbell alone for someone with short arms', () => {
    const bias = deriveTrainingBias({ composition, shape, armLength: 'short', legLength: 'average' });
    expect(bias.swaps.find((entry) => entry.from === 'barbell_bench_press')).toBeUndefined();
  });

  it('reports more headroom for someone with more left to gain', () => {
    const untrained = analyseComposition({ ...base, weightKg: 64, bodyFatPercent: 14 });
    const bias = deriveTrainingBias({
      composition: untrained,
      shape: bodyShape(untrained, frame),
      armLength: 'average',
      legLength: 'average',
    });

    expect(bias.headroom).toBeGreaterThan(0.5);
  });

  it('never returns more than a person will read', () => {
    const bias = deriveTrainingBias({ composition, shape, armLength: 'long', legLength: 'long' });

    expect(bias.emphasise.length).toBeLessThanOrEqual(3);
    expect(bias.reasons.length).toBeLessThanOrEqual(3);
    expect(bias.swaps.length).toBeLessThanOrEqual(2);
  });

  it('does not change how hard anyone trains', () => {
    // Emphasis and exercise choice only. Volume and intensity come from the
    // plan and from what the user is actually doing, never from their shape.
    const bias = deriveTrainingBias({ composition, shape, armLength: 'long', legLength: 'long' });
    expect(Object.keys(bias).sort()).toEqual(['emphasise', 'headroom', 'reasons', 'swaps']);
  });
});
