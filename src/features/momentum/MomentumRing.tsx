import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop, useSweep } from '@/design-system/motion';
import { colors, spacing } from '@/design-system/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0–100, or null before there is anything to score. */
  score: number | null;
  color: string;
  label: string;
  size?: number;
  strokeWidth?: number;
};

/**
 * The dominant reading on Today.
 *
 * Three layers of motion, all slow: the arc draws itself to the current score,
 * the whole ring breathes on the app heartbeat, and a marker sweeps the track
 * continuously. The sweep is what makes it read as a live instrument instead of
 * a progress bar bent into a circle.
 */
export function MomentumRing({ score, color, label, size = 176, strokeWidth = 6 }: Props) {
  const reduced = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(0);
  const beat = useLoop(motion.loop.breathe);
  const sweep = useSweep(motion.loop.sweep);

  const target = score === null ? 0 : Math.max(0, Math.min(100, score)) / 100;

  useEffect(() => {
    if (reduced) {
      progress.value = target;
      return;
    }
    progress.value = withDelay(
      motion.stagger * 2,
      withTiming(target, { duration: 1100, easing: motion.easing.out }),
    );
  }, [target, progress, reduced]);

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const glow = useAnimatedStyle(() => ({
    opacity: interpolate(beat.value, [0, 1], [0.10, 0.22]),
    transform: [{ scale: interpolate(beat.value, [0, 1], [0.97, 1.03]) }],
  }));

  const marker = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweep.value * 360}deg` }],
  }));

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { borderRadius: size / 2, backgroundColor: color },
          glow,
        ]}
      />

      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.border}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={arcProps}
          // Start the arc at twelve o'clock rather than three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <Animated.View pointerEvents="none" style={[styles.markerHost, marker]}>
        <View style={[styles.marker, { backgroundColor: color, top: strokeWidth / 2 - 1.5 }]} />
      </Animated.View>

      <View style={styles.center} pointerEvents="none">
        <AnimatedNumber
          value={score}
          variant="display"
          style={score === null ? { color: colors.textTertiary } : undefined}
        />
        <Label style={styles.label}>{label}</Label>
        {score === null ? (
          <Text variant="caption" tone="tertiary" style={styles.empty}>
            No data yet
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  markerHost: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  marker: {
    width: 3,
    height: 3,
    borderRadius: 2,
    opacity: 0.9,
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
  },
  label: {
    marginTop: spacing.xs,
  },
  empty: {
    marginTop: 2,
  },
});
