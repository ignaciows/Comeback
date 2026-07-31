import type { MovementPattern } from '@/domain/types';
import type { Frame } from '@/features/training/skeleton';

/**
 * One rep of each movement pattern, as two angle keyframes.
 *
 * Authored as angles rather than positions, so the figure keeps its
 * proportions through every frame in between. Values are degrees with 0
 * pointing down the screen and 180 straight up; elbow and knee are bends
 * relative to the limb above them, so 0 is a straight arm or leg.
 *
 * The tempos are the tempos the lifts are actually performed at. A squat that
 * cycles as fast as a curl reads as a completely different exercise, and the
 * point of the drawing is to show what the movement is.
 */

export type Movement = {
  /** The bottom, or start, of the rep. */
  from: Frame;
  /** The top, or finish. */
  to: Frame;
  /** One full rep, milliseconds. */
  tempo: number;
  /**
   * True for an isometric. A plank has no rep to draw, so the two keyframes
   * differ only by a breath — which is correct, and would otherwise look like
   * a movement someone forgot to finish authoring.
   */
  hold?: boolean;
  station: 'floor' | 'bench' | 'rack' | 'cable' | 'machine' | 'bar_overhead';
  implement: 'bar' | 'dumbbell' | 'handle' | 'none';
  /**
   * Where the weight sits. A back squat carries the bar on the shoulders, and
   * drawing it in the hands puts it floating in mid-air beside the figure.
   */
  holdAt?: 'hands' | 'shoulders';
};

/** Standing upright: a small knee bend so the legs read as legs. */
const standing = {
  hip: [50, 46] as [number, number],
  torso: 180,
  thigh: 4,
  knee: -14,
  spreadLeg: -9,
  spreadArm: -14,
};

export const MOVEMENTS: Record<MovementPattern, Movement> = {
  // Lying on a bench, head to the left, pressing straight up.
  horizontal_push: {
    from: { hip: [62, 62], torso: 272, shoulder: 206, elbow: 84, thigh: 40, knee: -112, spreadLeg: 14, spreadArm: -20 },
    to: { hip: [62, 62], torso: 272, shoulder: 178, elbow: 4, thigh: 40, knee: -112, spreadLeg: 14, spreadArm: -8 },
    tempo: 2600,
    station: 'bench',
    implement: 'bar',
  },

  // Standing, pressing overhead.
  vertical_push: {
    from: { ...standing, hip: [50, 57], shoulder: 146, elbow: 104 },
    to: { ...standing, hip: [50, 57], shoulder: 176, elbow: 8 },
    tempo: 2600,
    station: 'rack',
    implement: 'bar',
  },

  // Hinged over, rowing the bar to the belt.
  horizontal_pull: {
    from: { hip: [58, 50], torso: 226, shoulder: 6, elbow: 8, thigh: 8, knee: -24, spreadLeg: -10, spreadArm: -12 },
    to: { hip: [58, 50], torso: 226, shoulder: 46, elbow: 92, thigh: 8, knee: -24, spreadLeg: -10, spreadArm: -12 },
    tempo: 2400,
    station: 'floor',
    implement: 'bar',
  },

  // Pulling down from overhead, elbows driving to the ribs.
  vertical_pull: {
    from: { ...standing, hip: [50, 56], shoulder: 170, elbow: 14 },
    to: { ...standing, hip: [50, 56], shoulder: 126, elbow: 88 },
    tempo: 2400,
    station: 'cable',
    implement: 'handle',
  },

  // Bar on the back. Hips travel back and down, torso leans with them.
  squat: {
    from: { hip: [52, 64], torso: 194, shoulder: 214, elbow: 68, thigh: 52, knee: -118, spreadLeg: -12, spreadArm: -14 },
    to: { hip: [50, 44], torso: 184, shoulder: 200, elbow: 74, thigh: 4, knee: -12, spreadLeg: -10, spreadArm: -16 },
    tempo: 3000,
    station: 'rack',
    implement: 'bar',
    holdAt: 'shoulders',
  },

  // Hips back, bar tracking the legs, back flat throughout.
  hinge: {
    from: { hip: [56, 50], torso: 222, shoulder: 4, elbow: 4, thigh: 6, knee: -20, spreadLeg: -8, spreadArm: -12 },
    to: { hip: [50, 44], torso: 182, shoulder: 2, elbow: 2, thigh: 4, knee: -10, spreadLeg: -8, spreadArm: -12 },
    tempo: 3000,
    station: 'floor',
    implement: 'bar',
  },

  // Split stance, back knee dropping straight down.
  lunge: {
    from: { hip: [50, 56], torso: 184, shoulder: 6, elbow: 8, thigh: 34, knee: -92, spreadLeg: -66, spreadArm: -14 },
    to: { hip: [50, 44], torso: 182, shoulder: 4, elbow: 6, thigh: 20, knee: -40, spreadLeg: -44, spreadArm: -14 },
    tempo: 2800,
    station: 'floor',
    implement: 'dumbbell',
  },

  // Standing curl: everything still except the forearm.
  isolation: {
    from: { ...standing, shoulder: 6, elbow: 10 },
    to: { ...standing, shoulder: 6, elbow: 142 },
    tempo: 2200,
    station: 'floor',
    implement: 'dumbbell',
  },

  // Loaded carry: upright, arms hanging, mid-stride.
  carry: {
    from: { ...standing, shoulder: 4, elbow: 3, thigh: 30, knee: -34, spreadLeg: -62 },
    to: { ...standing, shoulder: 4, elbow: 3, thigh: -26, knee: -6, spreadLeg: 62 },
    tempo: 1600,
    station: 'floor',
    implement: 'dumbbell',
  },

  // Plank: horizontal, forearms down, holding but breathing.
  core: {
    from: { hip: [58, 58], torso: 268, shoulder: 24, elbow: 96, thigh: 96, knee: -6, spreadLeg: 10, spreadArm: -16 },
    to: { hip: [58, 64], torso: 274, shoulder: 24, elbow: 96, thigh: 96, knee: -6, spreadLeg: 10, spreadArm: -16 },
    tempo: 3400,
    hold: true,
    station: 'floor',
    implement: 'none',
  },
};
