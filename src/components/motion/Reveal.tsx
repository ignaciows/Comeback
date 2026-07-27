import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/design-system/motion';

type Props = {
  children: React.ReactNode;
  /** Position in the stagger sequence; multiplied by the stagger token. */
  index?: number;
  /** Distance the block travels up as it lands. */
  offset?: number;
  style?: ViewStyle;
};

/**
 * Entrance for a block of content: it lands from slightly below, staggered by
 * position. Screens read as being assembled from live data rather than shown.
 */
export function Reveal({ children, index = 0, offset = 10, style }: Props) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      index * motion.stagger,
      withTiming(1, { duration: motion.duration.reveal, easing: motion.easing.out }),
    );
  }, [index, progress, reduced]);

  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * offset }],
  }));

  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
