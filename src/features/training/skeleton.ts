/**
 * A stick figure that cannot dislocate itself.
 *
 * The first version of this animated joint *positions*: a start pose, an end
 * pose, and a linear interpolation between them. That is wrong in a way that is
 * obvious once you see it — the straight line between two elbow positions does
 * not preserve the distance to the shoulder, so the upper arm stretches by a
 * third and the forearm by half on the way up. The figure looks like it is
 * coming apart, because it is.
 *
 * So this animates *angles* instead, with bone lengths fixed as constants. A
 * limb is a length and a direction; interpolating the direction rotates it, and
 * nothing can change how long it is. The stretch is not fixed here, it is
 * unrepresentable.
 *
 * Note on where this runs: the animation does **not** call into here. A
 * function imported from another module is not workletized by Reanimated —
 * a `'worklet'` directive does not survive the module boundary — so calling
 * one from the UI thread throws at runtime, invisibly to both the typechecker
 * and the unit tests. `ExerciseAnimation` writes the same arithmetic out
 * longhand inside its own worklet; this file stays the tested definition of
 * it, and the tests below are what keep the two honest.
 *
 * Convention: a 100×100 box, y downwards, angles in degrees where 0 points
 * straight down and 180 straight up. Every angle is absolute except the elbow
 * and knee, which are measured relative to the limb above them — that is how
 * joints actually work, and it means bending an elbow does not require
 * recomputing the shoulder.
 */

export type Point = [number, number];

/** Bone lengths. Roughly human proportions for a 100-unit figure. */
export const BONES = {
  neck: 7,
  torso: 26,
  upperArm: 15,
  forearm: 14,
  thigh: 19,
  shin: 19,
} as const;

export type Frame = {
  /** The root. Everything else hangs off it. */
  hip: Point;
  /** Hip to neck. 180 is upright, 270 is lying with the head to the left. */
  torso: number;
  /** Absolute angle of the upper arm. */
  shoulder: number;
  /** Bend at the elbow, relative to the upper arm. 0 is a straight arm. */
  elbow: number;
  /** Absolute angle of the thigh. */
  thigh: number;
  /** Bend at the knee, relative to the thigh. 0 is a straight leg. */
  knee: number;
  /**
   * How far the far-side limbs differ from the near ones, in degrees.
   *
   * A side-on figure drawn with one arm and one leg reads as a stick, not a
   * person — standing poses collapse into a single vertical line. Offsetting
   * the far side by a few degrees is enough to say "there is a body here",
   * and a lot in a split stance, where the legs really are doing different
   * things.
   */
  spreadLeg: number;
  spreadArm: number;
};

export type Skeleton = {
  hip: Point;
  neck: Point;
  head: Point;
  shoulder: Point;
  elbow: Point;
  hand: Point;
  knee: Point;
  foot: Point;
  /** The limbs on the far side of the body, drawn behind and dimmer. */
  farKnee: Point;
  farFoot: Point;
  farElbow: Point;
  farHand: Point;
};

/** Unit vector for an angle, with 0 pointing down the screen. */
function direction(degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return [Math.sin(radians), Math.cos(radians)];
}

function step(from: Point, degrees: number, length: number): Point {
  const [dx, dy] = direction(degrees);
  return [from[0] + dx * length, from[1] + dy * length];
}

/**
 * Joint positions for a frame.
 *
 * Pure forward kinematics: walk out from the hip, one bone at a time. The
 * shoulder sits at the neck rather than being its own joint — at this size the
 * difference is under a pixel and the extra joint is one more thing to get
 * wrong.
 */
export function solve(frame: Frame): Skeleton {
  const neck = step(frame.hip, frame.torso, BONES.torso);
  const head = step(neck, frame.torso, BONES.neck);

  const elbow = step(neck, frame.shoulder, BONES.upperArm);
  const hand = step(elbow, frame.shoulder + frame.elbow, BONES.forearm);

  const knee = step(frame.hip, frame.thigh, BONES.thigh);
  const foot = step(knee, frame.thigh + frame.knee, BONES.shin);

  const farThigh = frame.thigh + frame.spreadLeg;
  const farKnee = step(frame.hip, farThigh, BONES.thigh);
  const farFoot = step(farKnee, farThigh + frame.knee, BONES.shin);

  const farShoulder = frame.shoulder + frame.spreadArm;
  const farElbow = step(neck, farShoulder, BONES.upperArm);
  const farHand = step(farElbow, farShoulder + frame.elbow, BONES.forearm);

  return {
    hip: frame.hip,
    neck,
    head,
    shoulder: neck,
    elbow,
    hand,
    knee,
    foot,
    farKnee,
    farFoot,
    farElbow,
    farHand,
  };
}

/**
 * A frame part-way between two, at `t` from 0 to 1.
 *
 * Angles interpolate as angles and the hip as a position — which is the whole
 * point: no combination of inputs can produce a bone of the wrong length.
 */
export function blend(from: Frame, to: Frame, t: number): Frame {
  const mix = (a: number, b: number) => {
      return a + (b - a) * t;
  };

  return {
    hip: [mix(from.hip[0], to.hip[0]), mix(from.hip[1], to.hip[1])],
    torso: mix(from.torso, to.torso),
    shoulder: mix(from.shoulder, to.shoulder),
    elbow: mix(from.elbow, to.elbow),
    thigh: mix(from.thigh, to.thigh),
    knee: mix(from.knee, to.knee),
    spreadLeg: mix(from.spreadLeg, to.spreadLeg),
    spreadArm: mix(from.spreadArm, to.spreadArm),
  };
}

/** The body, without the working arm: head, torso, and the near leg. */
export function bodyPath(s: Skeleton): string {
  return (
    `M${r(s.head[0])} ${r(s.head[1])} L${r(s.neck[0])} ${r(s.neck[1])} ` +
    `L${r(s.hip[0])} ${r(s.hip[1])} L${r(s.knee[0])} ${r(s.knee[1])} ` +
    `L${r(s.foot[0])} ${r(s.foot[1])}`
  );
}

/** The arm doing the work, drawn separately so it can carry the accent. */
export function armPath(s: Skeleton): string {
  return (
    `M${r(s.shoulder[0])} ${r(s.shoulder[1])} L${r(s.elbow[0])} ${r(s.elbow[1])} ` +
    `L${r(s.hand[0])} ${r(s.hand[1])}`
  );
}

/** The far arm and leg, drawn behind everything in a dimmer stroke. */
export function farPath(s: Skeleton): string {
  return (
    `M${r(s.hip[0])} ${r(s.hip[1])} L${r(s.farKnee[0])} ${r(s.farKnee[1])} ` +
    `L${r(s.farFoot[0])} ${r(s.farFoot[1])} ` +
    `M${r(s.shoulder[0])} ${r(s.shoulder[1])} L${r(s.farElbow[0])} ${r(s.farElbow[1])} ` +
    `L${r(s.farHand[0])} ${r(s.farHand[1])}`
  );
}

function r(value: number): number {
  return Math.round(value * 10) / 10;
}
