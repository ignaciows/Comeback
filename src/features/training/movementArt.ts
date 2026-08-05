import type { ImageSourcePropType } from 'react-native';

/**
 * Rendered wireframes, by exercise id.
 *
 * Deliberately partial. `MovementArt` falls back to the two-frame SVG diagram
 * for anything not listed here, so the app is complete at every point on the
 * way to fifty-one renders rather than only at the end.
 *
 * These are the movements the diagram served worst: the ones whose whole
 * difficulty is the setup — which machine, which pad against which limb, what
 * your hands are holding. A stick figure cannot tell a seated calf raise from
 * a leg press, and those are exactly the ones people get wrong.
 *
 * Static `require` calls, never a computed path: the bundler resolves these at
 * build time, and a template string would ship no image and fail on device.
 */
export const MOVEMENT_ART: Record<string, ImageSourcePropType> = {
  hanging_leg_raise: require('../../../assets/movements/hanging_leg_raise.png'),
  seated_leg_curl: require('../../../assets/movements/seated_leg_curl.png'),
  dip: require('../../../assets/movements/dip.png'),
  standing_calf_raise: require('../../../assets/movements/standing_calf_raise.png'),
  seated_calf_raise: require('../../../assets/movements/seated_calf_raise.png'),
  cable_crunch: require('../../../assets/movements/cable_crunch.png'),
  back_extension: require('../../../assets/movements/back_extension.png'),
  stationary_bike: require('../../../assets/movements/stationary_bike.png'),
  incline_walk: require('../../../assets/movements/incline_walk.png'),
  mobility_flow: require('../../../assets/movements/mobility_flow.png'),
};

/** Whether this movement has a render, or falls back to the diagram. */
export function hasMovementArt(exerciseId: string): boolean {
  return exerciseId in MOVEMENT_ART;
}
