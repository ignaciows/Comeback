import type { ImageSourcePropType } from 'react-native';

import type { WireframeKey } from '@/domain/body/wireframe';

/**
 * The twelve cached wireframes, keyed exactly as `wireframeKey` returns them.
 *
 * Static `require` calls rather than a computed path because the bundler
 * resolves these at build time — a template string here would ship no images
 * at all and fail only on the device.
 */
export const BODY_ART: Record<WireframeKey, ImageSourcePropType> = {
  slim_10: require('../../../assets/bodies/slim_10.png'),
  slim_15: require('../../../assets/bodies/slim_15.png'),
  slim_20: require('../../../assets/bodies/slim_20.png'),
  slim_25: require('../../../assets/bodies/slim_25.png'),
  medium_10: require('../../../assets/bodies/medium_10.png'),
  medium_15: require('../../../assets/bodies/medium_15.png'),
  medium_20: require('../../../assets/bodies/medium_20.png'),
  medium_25: require('../../../assets/bodies/medium_25.png'),
  broad_10: require('../../../assets/bodies/broad_10.png'),
  broad_15: require('../../../assets/bodies/broad_15.png'),
  broad_20: require('../../../assets/bodies/broad_20.png'),
  broad_25: require('../../../assets/bodies/broad_25.png'),
};
