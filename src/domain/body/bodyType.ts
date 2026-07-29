import type { LimbLength, MuscleGroup } from '@/domain/types';
import { clamp, round } from '@/utils/math';
import type { BodyComposition, BodyShape } from './composition';

/**
 * Building a plan around the body someone actually has.
 *
 * The obvious thing to do here is somatotypes — ectomorph, mesomorph,
 * endomorph — and it is worth saying plainly why this does not.
 *
 * Heath–Carter somatotyping is a *descriptive* method: it scores how someone
 * looks right now from skinfolds and bone breadths. It was never shown to
 * predict how anyone responds to training, and the response data we do have
 * cuts against the idea. Hubal et al. (2005), measuring 585 people through an
 * identical twelve-week programme, found muscle size changes ranging from
 * roughly zero to over 50% — and that spread was not explained by build.
 * Telling a "hardgainer" to train differently because of their shape is
 * dressing a horoscope in gym clothes.
 *
 * What genuinely does differ between bodies, and does change the plan:
 *
 *  · **How much room is left.** Someone far from their FFMI ceiling can gain
 *    quickly on almost any sane programme; someone near it cannot, and needs
 *    the plan to spend its effort on the parts that still move.
 *
 *  · **Leverages.** Limb lengths relative to torso change which lifts suit a
 *    person. Long femurs make an upright squat mechanically hard, so the same
 *    quads are better served by a front squat, hack squat or leg press. Long
 *    arms lengthen the bench press stroke and shorten the deadlift's. This is
 *    geometry, not physiology, and it is not controversial.
 *
 *  · **Proportion, for a goal that is about looking a certain way.** Perceived
 *    muscularity is driven more by shoulder-to-waist ratio than by mass. That
 *    is why lateral delts and upper back pay off visually far above their
 *    contribution to bodyweight — and it is an argument about geometry again,
 *    not about anyone's "type".
 *
 * So the app asks for what it can use — height, weight, body fat, an optional
 * wrist measurement, and how long the limbs are relative to the torso — and
 * derives emphasis from that.
 */

export type BodyProfileInput = {
  composition: BodyComposition;
  shape: BodyShape;
  /** Arms relative to torso. Affects pressing and pulling choices. */
  armLength: LimbLength;
  /** Legs relative to torso. Affects squat choice more than anything else. */
  legLength: LimbLength;
};

export type TrainingBias = {
  /** Muscles worth extra volume, best first. */
  emphasise: MuscleGroup[];
  /** Why, in one line each. */
  reasons: string[];
  /** Exercises that suit these leverages, and the ones they replace. */
  swaps: { from: string; to: string; because: string }[];
  /** How much room is left before gains slow, 0–1. */
  headroom: number;
};

/**
 * What this particular body should spend its training on.
 *
 * Note what is absent: nothing here changes how *hard* the person trains or
 * how many sets they get. Those come from the plan and from what they are
 * actually doing, not from their shape.
 */
export function deriveTrainingBias(input: BodyProfileInput): TrainingBias {
  const emphasise: MuscleGroup[] = [];
  const reasons: string[] = [];
  const swaps: TrainingBias['swaps'] = [];

  // --- Proportion: the shoulder-to-waist ratio does the visual work --------
  if (input.shape.taper < 1.5) {
    emphasise.push('shoulders', 'back');
    reasons.push(
      'Shoulders and upper back widen the top faster than anything else, and width over the waist is what reads as built.',
    );
  } else {
    emphasise.push('back');
    reasons.push('Upper back keeps the taper you already have as weight goes on.');
  }

  // --- Leverages: pick lifts the skeleton suits ----------------------------
  if (input.legLength === 'long') {
    swaps.push({
      from: 'back_squat',
      to: 'front_squat',
      because: 'Long femurs push the hips back in a back squat, turning it into a hinge. A front squat keeps it a squat.',
    });
    swaps.push({
      from: 'back_squat',
      to: 'leg_press',
      because: 'Same quads, no balancing act — useful while the pattern is being learned.',
    });
    emphasise.push('quads');
    reasons.push('Long legs put the quads at a disadvantage in most squats, so they need the direct work.');
  }

  if (input.armLength === 'long') {
    swaps.push({
      from: 'barbell_bench_press',
      to: 'dumbbell_bench_press',
      because: 'A longer stroke means a barbell pins the shoulders at the bottom. Dumbbells let the path adjust.',
    });
    reasons.push('Long arms make deadlifts easier and presses harder — the plan leans into the first and shortens the second.');
  }

  if (input.armLength === 'short') {
    reasons.push('Short arms are an advantage on presses; there is no reason to avoid the barbell.');
  }

  // --- Room left ----------------------------------------------------------
  const headroom = round(clamp(1 - input.composition.developed, 0, 1), 2);
  if (headroom > 0.35) {
    reasons.push('You are a long way from your frame’s ceiling, so compound lifts and steady progression do most of the work.');
  } else if (headroom < 0.15) {
    reasons.push('Close to the usual drug-free ceiling. Gains from here come from specific weak points, not from more of everything.');
  }

  // Nothing repeated, nothing longer than a person will read.
  return {
    emphasise: [...new Set(emphasise)].slice(0, 3),
    reasons: reasons.slice(0, 3),
    swaps: swaps.slice(0, 2),
    headroom,
  };
}

/**
 * How much muscle is realistically still available, in kilograms.
 *
 * The ceiling is the height-normalised FFMI limit; the distance to it is what
 * is left. Deliberately not a promise — it is the size of the room, not a
 * prediction of how much of it gets used.
 */
export function remainingPotentialKg(composition: BodyComposition, heightCm: number, ceiling = 25): number {
  const heightM = heightCm / 100;
  const currentNormalised = composition.ffmi;
  if (currentNormalised >= ceiling) return 0;

  // Undo the height normalisation to get back to real kilograms.
  const targetRaw = ceiling - 6.1 * (1.8 - heightM);
  const targetLean = targetRaw * heightM ** 2;
  return round(Math.max(0, targetLean - composition.leanKg), 1);
}
