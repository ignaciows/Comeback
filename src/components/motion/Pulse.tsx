import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { colors, radius, spacing } from '@/design-system/tokens';

/**
 * The "this is running" mark: a dot with a ring expanding out of it on the
 * app's heartbeat. Used wherever a value is being kept up to date.
 */
export function LiveDot({
  color = colors.accent,
  size = 6,
  style,
}: {
  color?: string;
  size?: number;
  style?: ViewStyle;
}) {
  const beat = useLoop(motion.loop.heartbeat);

  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(beat.value, [0, 0.35, 1], [0.45, 0.16, 0]),
    transform: [{ scale: interpolate(beat.value, [0, 1], [1, 2.8]) }],
  }));

  const core = useAnimatedStyle(() => ({
    opacity: interpolate(beat.value, [0, 0.5, 1], [1, 0.75, 1]),
  }));

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Animated.View
        style={[
          styles.absolute,
          { borderRadius: size, backgroundColor: color },
          ring,
        ]}
      />
      <Animated.View
        style={[styles.absolute, { borderRadius: size, backgroundColor: color }, core]}
      />
    </View>
  );
}

/** Live dot plus a label, e.g. "Tracking · updated 2m ago". */
export function LiveIndicator({
  label,
  color = colors.accent,
  style,
}: {
  label: string;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.indicator, style]}>
      <LiveDot color={color} />
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}

/**
 * Slow vertical scan across a block, like a readout refreshing. Extremely low
 * contrast on purpose — it should be felt more than seen.
 */
export function ScanLine({ height, style }: { height: number; style?: ViewStyle }) {
  const sweep = useLoop(motion.loop.sweep);

  const line = useAnimatedStyle(() => ({
    opacity: interpolate(sweep.value, [0, 0.15, 0.85, 1], [0, 0.5, 0.5, 0]),
    transform: [{ translateY: interpolate(sweep.value, [0, 1], [0, height]) }],
  }));

  return (
    <View pointerEvents="none" style={[styles.scanHost, { height }, style]}>
      <Animated.View style={[styles.scan, line]} />
    </View>
  );
}

/** Wraps content in a barely-there breathing opacity. For idle placeholders. */
export function Breathing({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const breath = useLoop(motion.loop.breathe);
  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.55, 1]),
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scanHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    overflow: 'hidden',
  },
  scan: {
    height: 1,
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
  },
});
