import type { ImageSourcePropType } from 'react-native';

/**
 * Rendered wireframes, by exercise id.
 *
 * `MovementArt` falls back to the two-frame SVG diagram for anything not
 * listed here, so the app stays complete whether the map has ten entries or
 * fifty. That fallback is not vestigial: `trap_bar_deadlift` is deliberately
 * absent because the generator kept drawing a straight barbell instead of a
 * hexagonal frame, and a picture that shows the wrong equipment teaches the
 * wrong thing more effectively than no picture at all.
 *
 * Static `require` calls, never a computed path: the bundler resolves these at
 * build time, and a template string would ship no image and fail on device.
 */
export const MOVEMENT_ART: Record<string, ImageSourcePropType> = {
  assisted_pull_up: require('../../../assets/movements/assisted_pull_up.png'),
  back_extension: require('../../../assets/movements/back_extension.png'),
  back_squat: require('../../../assets/movements/back_squat.png'),
  barbell_bench_press: require('../../../assets/movements/barbell_bench_press.png'),
  barbell_curl: require('../../../assets/movements/barbell_curl.png'),
  barbell_row: require('../../../assets/movements/barbell_row.png'),
  bulgarian_split_squat: require('../../../assets/movements/bulgarian_split_squat.png'),
  cable_crunch: require('../../../assets/movements/cable_crunch.png'),
  cable_curl: require('../../../assets/movements/cable_curl.png'),
  cable_fly: require('../../../assets/movements/cable_fly.png'),
  cable_lateral_raise: require('../../../assets/movements/cable_lateral_raise.png'),
  chest_press_machine: require('../../../assets/movements/chest_press_machine.png'),
  chest_supported_row: require('../../../assets/movements/chest_supported_row.png'),
  deadlift: require('../../../assets/movements/deadlift.png'),
  dip: require('../../../assets/movements/dip.png'),
  dumbbell_bench_press: require('../../../assets/movements/dumbbell_bench_press.png'),
  dumbbell_curl: require('../../../assets/movements/dumbbell_curl.png'),
  dumbbell_fly: require('../../../assets/movements/dumbbell_fly.png'),
  dumbbell_row: require('../../../assets/movements/dumbbell_row.png'),
  dumbbell_shoulder_press: require('../../../assets/movements/dumbbell_shoulder_press.png'),
  face_pull: require('../../../assets/movements/face_pull.png'),
  front_squat: require('../../../assets/movements/front_squat.png'),
  goblet_squat: require('../../../assets/movements/goblet_squat.png'),
  hack_squat: require('../../../assets/movements/hack_squat.png'),
  hanging_leg_raise: require('../../../assets/movements/hanging_leg_raise.png'),
  hip_thrust: require('../../../assets/movements/hip_thrust.png'),
  incline_dumbbell_press: require('../../../assets/movements/incline_dumbbell_press.png'),
  incline_walk: require('../../../assets/movements/incline_walk.png'),
  lat_pulldown: require('../../../assets/movements/lat_pulldown.png'),
  lateral_raise: require('../../../assets/movements/lateral_raise.png'),
  leg_extension: require('../../../assets/movements/leg_extension.png'),
  leg_press: require('../../../assets/movements/leg_press.png'),
  lying_leg_curl: require('../../../assets/movements/lying_leg_curl.png'),
  mobility_flow: require('../../../assets/movements/mobility_flow.png'),
  overhead_press: require('../../../assets/movements/overhead_press.png'),
  overhead_triceps_extension: require('../../../assets/movements/overhead_triceps_extension.png'),
  pec_deck: require('../../../assets/movements/pec_deck.png'),
  plank: require('../../../assets/movements/plank.png'),
  pull_up: require('../../../assets/movements/pull_up.png'),
  push_up: require('../../../assets/movements/push_up.png'),
  rear_delt_fly: require('../../../assets/movements/rear_delt_fly.png'),
  romanian_deadlift: require('../../../assets/movements/romanian_deadlift.png'),
  seated_cable_row: require('../../../assets/movements/seated_cable_row.png'),
  seated_calf_raise: require('../../../assets/movements/seated_calf_raise.png'),
  seated_leg_curl: require('../../../assets/movements/seated_leg_curl.png'),
  shoulder_press_machine: require('../../../assets/movements/shoulder_press_machine.png'),
  standing_calf_raise: require('../../../assets/movements/standing_calf_raise.png'),
  stationary_bike: require('../../../assets/movements/stationary_bike.png'),
  triceps_pushdown: require('../../../assets/movements/triceps_pushdown.png'),
  walking_lunge: require('../../../assets/movements/walking_lunge.png'),
};

/** Whether this movement has a render, or falls back to the diagram. */
export function hasMovementArt(exerciseId: string): boolean {
  return exerciseId in MOVEMENT_ART;
}
