import type { BiologicalSex, ExperienceLevel } from '@/domain/types';
import { clamp, round } from '@/utils/math';

/**
 * What a body is made of, and what shape that makes it.
 *
 * Everything here is deterministic arithmetic on numbers the user already
 * gives the app — height, weight, body fat percentage, and optionally a wrist
 * measurement. No photograph, no model, no guess dressed as a scan.
 *
 * Sources, and what each is actually good for:
 *
 *  · **Fat-free mass index.** FFM ÷ height², with the height normalisation
 *    from Kouri et al. (1995), who measured it across drug-free and
 *    steroid-using lifters. Their drug-free population topped out around 25,
 *    which is the ceiling used here. FFMI is the honest measure of "how
 *    muscular is this person" because it is mass adjusted for frame, not a
 *    weight that a tall person can never reach.
 *
 *  · **Frame size from wrist circumference.** The wrist is almost pure bone
 *    and connective tissue: it barely changes with training or with fat, so
 *    it is the one cheap proxy for skeletal frame. Casey Butt's regressions
 *    on drug-free record holders use wrist and ankle to predict maximum
 *    muscular bodyweight; the wrist term alone is used here, since asking for
 *    an ankle measurement to slightly sharpen an estimate is a bad trade.
 *
 *  · **Waist from fat mass.** Waist circumference tracks visceral and
 *    subcutaneous fat closely enough for a drawing. It is not used for any
 *    health claim.
 *
 * The one thing this deliberately does not do is somatotyping — see
 * `docs/body-model.md` for why the ectomorph/mesomorph/endomorph framework
 * does not survive contact with the evidence, and what replaces it.
 */

export type BodyInput = {
  heightCm: number;
  weightKg: number;
  /** From a scale that measures it. Null when unknown. */
  bodyFatPercent: number | null;
  sex: BiologicalSex;
  /** Around the narrowest point, below the bone. Null when not measured. */
  wristCm: number | null;
  experience: ExperienceLevel;
};

export type BodyComposition = {
  leanKg: number;
  fatKg: number;
  /** Fat-free mass index, height-normalised. */
  ffmi: number;
  /** How close to the drug-free ceiling, 0–1. */
  developed: number;
  /** True when body fat was assumed rather than measured. */
  estimatedFat: boolean;
  bodyFatPercent: number;
};

/** Drug-free upper bound on normalised FFMI (Kouri et al. 1995). */
export const FFMI_CEILING = 25;

/**
 * Roughly untrained and slight. Below this the scale bottoms out.
 *
 * `developed` measures position between here and the ceiling rather than a
 * fraction of the ceiling: nobody alive has an FFMI near zero, so dividing by
 * 25 squashes every real person into the top third of the scale and makes two
 * very different bodies draw almost identically.
 */
export const FFMI_FLOOR = 15;

/**
 * A stand-in body fat percentage when there is no scale.
 *
 * Deliberately crude and flagged as an estimate: BMI-based fat prediction has
 * error bars of several points on an individual, which is fine for drawing a
 * rough outline and useless for anything else.
 */
function assumeBodyFat(heightCm: number, weightKg: number, sex: BiologicalSex): number {
  const bmi = weightKg / (heightCm / 100) ** 2;
  // Deurenberg's equation, with age dropped (its age term is small next to
  // the error already present) and the unspecified case taking the midpoint.
  const sexTerm = sex === 'male' ? 10.8 : sex === 'female' ? 0 : 5.4;
  return clamp(1.2 * bmi - sexTerm - 5.4, 5, 50);
}

export function analyseComposition(input: BodyInput): BodyComposition {
  const estimatedFat = input.bodyFatPercent === null;
  const bodyFatPercent = input.bodyFatPercent ?? assumeBodyFat(input.heightCm, input.weightKg, input.sex);

  const fatKg = round(input.weightKg * (bodyFatPercent / 100), 1);
  const leanKg = round(input.weightKg - fatKg, 1);

  const heightM = input.heightCm / 100;
  const rawFfmi = leanKg / heightM ** 2;
  // Normalised to 1.8 m so tall and short lifters are on one scale.
  const ffmi = round(rawFfmi + 6.1 * (1.8 - heightM), 1);

  return {
    leanKg,
    fatKg,
    ffmi,
    developed: round(clamp((ffmi - FFMI_FLOOR) / (FFMI_CEILING - FFMI_FLOOR), 0, 1), 2),
    estimatedFat,
    bodyFatPercent: round(bodyFatPercent, 1),
  };
}

/**
 * Frame size, 0–1, from the wrist relative to height.
 *
 * Someone with 16 cm wrists at 186 cm carries muscle differently from someone
 * with 19 cm wrists at the same height — same training, different silhouette.
 * With no measurement this returns the middle, and the caller says so.
 */
export function frameSize(heightCm: number, wristCm: number | null): number {
  if (wristCm === null) return 0.5;
  // Ratios roughly 0.085–0.105 across adult men; scaled onto 0–1.
  const ratio = wristCm / heightCm;
  return round(clamp((ratio - 0.085) / 0.02, 0, 1), 2);
}

// ---------------------------------------------------------------------------
// From composition to a shape that can be drawn

export type BodyShape = {
  /** All widths are in the 100-unit space the silhouette is drawn in. */
  shoulderWidth: number;
  chestWidth: number;
  waistWidth: number;
  hipWidth: number;
  armThickness: number;
  legThickness: number;
  /** Shoulder over waist. The number people mean by "V-taper". */
  taper: number;
};

/**
 * Turns a composition into proportions.
 *
 * Muscle goes preferentially to the shoulders, back and legs; fat goes
 * preferentially to the waist. That is the whole reason the same weight looks
 * completely different on two people, and it is what makes the drawing worth
 * showing: gaining four kilos of lean mass widens the top, gaining four kilos
 * of fat widens the middle.
 */
export function bodyShape(composition: BodyComposition, frame: number): BodyShape {
  // Lean development drives the upper body; 0.5 FFMI is a beginner, 1 is the
  // drug-free ceiling.
  const muscle = composition.developed;
  const fat = clamp((composition.bodyFatPercent - 8) / 24, 0, 1);

  const base = 26 + frame * 6;

  const shoulderWidth = round(base + muscle * 20, 1);
  const chestWidth = round(base * 0.86 + muscle * 13, 1);
  const waistWidth = round(base * 0.72 + fat * 17 + muscle * 3, 1);
  const hipWidth = round(base * 0.78 + fat * 9, 1);

  return {
    shoulderWidth,
    chestWidth,
    waistWidth,
    hipWidth,
    armThickness: round(6 + muscle * 6 + fat * 1.5, 1),
    legThickness: round(10 + muscle * 7 + fat * 2.5, 1),
    taper: round(shoulderWidth / waistWidth, 2),
  };
}

/**
 * The body at the end of a stretch of plan.
 *
 * Lean and fat change are given by the plan simulation, which already caps
 * muscle gain at what training can build. This only re-runs the composition
 * arithmetic on the result, so the drawing can never claim a change the plan
 * itself does not predict.
 */
export function projectComposition(
  input: BodyInput,
  change: { leanKg: number; fatKg: number },
): BodyComposition {
  const current = analyseComposition(input);
  const leanKg = Math.max(1, current.leanKg + change.leanKg);
  const fatKg = Math.max(0.5, current.fatKg + change.fatKg);
  const weightKg = leanKg + fatKg;

  return analyseComposition({
    ...input,
    weightKg,
    bodyFatPercent: (fatKg / weightKg) * 100,
  });
}

/** A short, honest read on where someone is. Never flattering, never rude. */
export function describeDevelopment(composition: BodyComposition, sex: BiologicalSex): string {
  const { ffmi } = composition;
  if (sex === 'female') {
    // The FFMI bands below were established in men; saying so is better than
    // quietly applying them anyway.
    return `Fat-free mass index ${ffmi}. The published bands are from male populations, so this is a trend line for you rather than a rank.`;
  }

  if (ffmi < 18) return `Fat-free mass index ${ffmi} — untrained range. This is where the fastest gains are available.`;
  if (ffmi < 20) return `Fat-free mass index ${ffmi} — visibly trained.`;
  if (ffmi < 22) return `Fat-free mass index ${ffmi} — well developed. Years of training, or a good frame.`;
  if (ffmi < 24) return `Fat-free mass index ${ffmi} — advanced. Close to what most people reach drug-free.`;
  return `Fat-free mass index ${ffmi} — at or beyond the usual drug-free ceiling.`;
}
