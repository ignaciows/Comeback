import type { ImageSourcePropType } from 'react-native';

/**
 * A render for every warm-up drill, keyed by the ids in `warmupProtocols.ts`.
 *
 * The drills needed pictures more than the lifts did. Nobody arrives at the
 * gym already knowing what a 90/90 or a scapular pull-up is, and a name plus
 * one line of text is not enough to attempt a movement you have never seen —
 * which is how a warm-up screen quietly becomes a screen everyone skips.
 */
export const WARMUP_ART: Record<string, ImageSourcePropType> = {
  ankle_rock: require('../../../assets/warmups/ankle_rock.png'),
  arm_circles: require('../../../assets/warmups/arm_circles.png'),
  band_face_pull: require('../../../assets/warmups/band_face_pull.png'),
  band_pull_apart: require('../../../assets/warmups/band_pull_apart.png'),
  bodyweight_squat: require('../../../assets/warmups/bodyweight_squat.png'),
  calf_raise_slow: require('../../../assets/warmups/calf_raise_slow.png'),
  cat_cow: require('../../../assets/warmups/cat_cow.png'),
  dead_bug: require('../../../assets/warmups/dead_bug.png'),
  dead_hang: require('../../../assets/warmups/dead_hang.png'),
  elbow_prep: require('../../../assets/warmups/elbow_prep.png'),
  glute_bridge: require('../../../assets/warmups/glute_bridge.png'),
  hip_hinge_dowel: require('../../../assets/warmups/hip_hinge_dowel.png'),
  leg_swings: require('../../../assets/warmups/leg_swings.png'),
  ninety_ninety: require('../../../assets/warmups/ninety_ninety.png'),
  scap_pull_up: require('../../../assets/warmups/scap_pull_up.png'),
  scap_push_up: require('../../../assets/warmups/scap_push_up.png'),
  thoracic_extension: require('../../../assets/warmups/thoracic_extension.png'),
  wall_slide: require('../../../assets/warmups/wall_slide.png'),
  wrist_prep: require('../../../assets/warmups/wrist_prep.png'),
};

export function hasWarmupArt(drillId: string): boolean {
  return drillId in WARMUP_ART;
}
