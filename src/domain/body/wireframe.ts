import type { PlanPhaseView } from '@/domain/plan/phases';
import { clamp, round } from '@/utils/math';

/**
 * Which of the twelve cached body wireframes a given body maps to.
 *
 * The plan already tells you a phase ends at "82 kg · 14 % body fat", which is
 * two numbers most people cannot picture. The wireframe is the same fact in a
 * form you can look at: this is roughly what someone of your build carrying
 * that much fat looks like.
 *
 * It is emphatically **not** a scan of the user. Twelve figures cannot be
 * personal, and pretending otherwise would be the app claiming to know
 * something it does not — the copy alongside says "someone your size", and the
 * grid is coarse enough that nobody could mistake it for a portrait.
 *
 * Build comes from fat-free mass index rather than weight, because weight
 * cannot tell a broad frame from a soft one, and that is the exact distinction
 * the picture has to get right.
 */

export type BuildClass = 'slim' | 'medium' | 'broad';
export const FAT_STEPS = [10, 15, 20, 25] as const;
export type FatStep = (typeof FAT_STEPS)[number];
export type WireframeKey = `${BuildClass}_${FatStep}`;

/**
 * FFMI bands, matching the ones `composition.ts` already narrates.
 *
 * Below 18 is the untrained range, 18–21 is visibly trained, above that is
 * well developed. Using the same cut points means the picture and the sentence
 * under it cannot disagree about which of the two someone is.
 */
export function buildClassFor(ffmi: number): BuildClass {
  if (ffmi < 18) return 'slim';
  if (ffmi < 21) return 'medium';
  return 'broad';
}

/** The nearest rendered fat level. Outside the range, the nearest end of it. */
export function fatStepFor(bodyFatPercent: number): FatStep {
  const value = clamp(bodyFatPercent, 0, 60);
  return FAT_STEPS.reduce((closest, step) =>
    Math.abs(step - value) < Math.abs(closest - value) ? step : closest,
  );
}

export function wireframeKey(ffmi: number, bodyFatPercent: number): WireframeKey {
  return `${buildClassFor(ffmi)}_${fatStepFor(bodyFatPercent)}`;
}

export type PhaseBody = {
  phaseIndex: number;
  key: WireframeKey;
  weightKg: number;
  bodyFatPercent: number;
  /** True when this is the body the plan starts from, not one it projects. */
  isToday: boolean;
};

export type PhaseBodyInput = {
  phases: PlanPhaseView[];
  weightKg: number;
  bodyFatPercent: number;
  heightCm: number;
};

/**
 * The body at the end of each phase, walked forward from today.
 *
 * Lean and fat are accumulated separately rather than reading a percentage off
 * the scale weight, because that is the only way a phase that adds three kilos
 * of muscle and one of fat comes out as a *lower* body fat percentage at a
 * higher weight — which is exactly the thing people find hard to believe and
 * the picture is here to show.
 *
 * FFMI is recomputed at each step, so a plan that adds enough muscle can move
 * someone from the slim figure to the medium one. Watching your own silhouette
 * change build over a two-year plan is the point.
 */
export function phaseBodies(input: PhaseBodyInput): PhaseBody[] {
  const heightM = input.heightCm / 100;
  let fatKg = (input.bodyFatPercent / 100) * input.weightKg;
  let leanKg = input.weightKg - fatKg;

  const ffmiOf = (lean: number) =>
    // Same height correction `composition.ts` applies, so the two agree about
    // which band a body is in.
    round(lean / (heightM * heightM) + 6.1 * (1.8 - heightM), 1);

  const bodies: PhaseBody[] = [
    {
      phaseIndex: -1,
      key: wireframeKey(ffmiOf(leanKg), input.bodyFatPercent),
      weightKg: round(input.weightKg, 1),
      bodyFatPercent: round(input.bodyFatPercent, 1),
      isToday: true,
    },
  ];

  for (const phase of input.phases) {
    leanKg += phase.leanChangeKg;
    fatKg += phase.fatChangeKg;
    const weightKg = Math.max(1, leanKg + fatKg);
    const bodyFatPercent = clamp((fatKg / weightKg) * 100, 2, 60);

    bodies.push({
      phaseIndex: phase.index,
      key: wireframeKey(ffmiOf(leanKg), bodyFatPercent),
      weightKg: round(weightKg, 1),
      bodyFatPercent: round(bodyFatPercent, 1),
      isToday: false,
    });
  }

  return bodies;
}

/**
 * Today, the middle of the plan, and the end.
 *
 * A figure against every phase of a two-year plan is eight silhouettes that
 * mostly look the same, which teaches nothing and costs a screenful. Three
 * milestones make the change legible because they are far enough apart to
 * actually differ.
 */
export function bodyMilestones(input: PhaseBodyInput): PhaseBody[] {
  const bodies = phaseBodies(input);
  if (bodies.length <= 3) return bodies;

  const middle = bodies[Math.floor(bodies.length / 2)];
  return [bodies[0], middle, bodies[bodies.length - 1]];
}
