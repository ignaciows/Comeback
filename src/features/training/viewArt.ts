import type { ImageSourcePropType } from 'react-native';

/**
 * Extra angles, keyed by the view ids in `movementViews.ts`.
 *
 * Partial on purpose in both directions. Only the compounds have extra views
 * at all — a lateral raise has one useful angle and a carousel of it would be
 * padding — and within those, three view entries were dropped because the
 * generator did not actually put the camera where the caption said it was.
 * `ViewCarousel` filters on this map, so an angle without an asset simply does
 * not appear rather than showing a picture that contradicts its own label.
 */
export const VIEW_ART: Record<string, ImageSourcePropType> = {
  back_squat_bottom: require('../../../assets/views/back_squat_bottom.png'),
  back_squat_rear: require('../../../assets/views/back_squat_rear.png'),
  back_squat_top: require('../../../assets/views/back_squat_top.png'),
  barbell_bench_press_bottom: require('../../../assets/views/barbell_bench_press_bottom.png'),
  barbell_bench_press_overhead: require('../../../assets/views/barbell_bench_press_overhead.png'),
  barbell_bench_press_top: require('../../../assets/views/barbell_bench_press_top.png'),
  barbell_row_top: require('../../../assets/views/barbell_row_top.png'),
  deadlift_bottom: require('../../../assets/views/deadlift_bottom.png'),
  deadlift_top: require('../../../assets/views/deadlift_top.png'),
  overhead_press_bottom: require('../../../assets/views/overhead_press_bottom.png'),
  overhead_press_rear: require('../../../assets/views/overhead_press_rear.png'),
  overhead_press_top: require('../../../assets/views/overhead_press_top.png'),
  pull_up_bottom: require('../../../assets/views/pull_up_bottom.png'),
  pull_up_rear: require('../../../assets/views/pull_up_rear.png'),
  pull_up_top: require('../../../assets/views/pull_up_top.png'),
};
