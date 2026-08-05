import type { ImageSourcePropType } from 'react-native';

/**
 * Frames of a full turn around one movement, in camera order.
 *
 * Twelve frames at thirty degrees apart: enough that dragging reads as
 * rotation rather than as flicking through pictures, few enough that the
 * whole ring is under two megabytes and ships over the update channel like
 * everything else.
 *
 * Back squat only, as the proof of concept. If it earns its place, the next
 * one is twelve more prompts and one array — there is no pipeline to build.
 */
export const TURNTABLE_FRAMES: Record<string, ImageSourcePropType[]> = {
  back_squat: [
    require('../../../assets/turntable/back_squat_00.png'),
    require('../../../assets/turntable/back_squat_01.png'),
    require('../../../assets/turntable/back_squat_02.png'),
    require('../../../assets/turntable/back_squat_03.png'),
    require('../../../assets/turntable/back_squat_04.png'),
    require('../../../assets/turntable/back_squat_05.png'),
    require('../../../assets/turntable/back_squat_06.png'),
    require('../../../assets/turntable/back_squat_07.png'),
    require('../../../assets/turntable/back_squat_08.png'),
    require('../../../assets/turntable/back_squat_09.png'),
    require('../../../assets/turntable/back_squat_10.png'),
    require('../../../assets/turntable/back_squat_11.png'),
  ],
};
