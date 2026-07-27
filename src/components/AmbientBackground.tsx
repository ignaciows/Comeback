import { useMemo, useRef } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Defs, Rect, Stop, RadialGradient as SvgRadialGradient } from 'react-native-svg';

import { motion, useLoop } from '@/design-system/motion';
import { colors } from '@/design-system/tokens';
import { timeOfDay, type TimeOfDay } from '@/utils/time';

/** One tint per part of the day, all from the existing palette. */
const TINT: Record<TimeOfDay, string> = {
  night: colors.info,
  dawn: colors.warning,
  morning: colors.accent,
  afternoon: colors.accent,
  evening: colors.warning,
};

const INTENSITY: Record<TimeOfDay, number> = {
  night: 0.16,
  dawn: 0.20,
  morning: 0.18,
  afternoon: 0.12,
  evening: 0.18,
};

/**
 * A single very low-contrast glow at the top of the screen, tinted by the time
 * of day and breathing on the app heartbeat. It is the only "atmosphere" in the
 * app: no gradients on cards, no colour washes behind content.
 */
export function AmbientBackground({ now = new Date() }: { now?: Date }) {
  const { width } = useWindowDimensions();
  const breath = useLoop(motion.loop.breathe);
  const period = useMemo(() => timeOfDay(now), [now]);
  const height = 340;
  // Gradient ids are global in SVG, so each instance gets its own.
  const gradientId = useRef(`ambient-${Math.random().toString(36).slice(2, 8)}`).current;

  const animated = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.7, 1]),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.root, { height }, animated]}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgRadialGradient id={gradientId} cx="50%" cy="0%" rx="80%" ry="100%">
            <Stop offset="0" stopColor={TINT[period]} stopOpacity={INTENSITY[period]} />
            <Stop offset="1" stopColor={TINT[period]} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill={`url(#${gradientId})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});
