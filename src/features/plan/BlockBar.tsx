import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { motion } from '@/design-system/motion';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { limitsFor, MAX_TOTAL_WEEKS, type CustomBlock } from '@/domain/plan/customPlan';
import { strategyProfile } from '@/domain/plan/strategies';

/**
 * One block of the plan, as something you drag.
 *
 * The bar's width is its length in weeks against the year the app will
 * project. Dragging it recalculates everything above and below in real time —
 * that live redraw is the whole point, because it turns "how long should the
 * bulk be" from a number you type into a trade-off you can feel.
 *
 * The block's own limits are drawn into the track, so where you cannot go is
 * visible before you try to go there.
 */

type Props = {
  block: CustomBlock;
  /** Weeks taken by the other blocks, which caps how far this one can grow. */
  weeksElsewhere: number;
  onChange: (weeks: number) => void;
  onPressLabel?: () => void;
  onRemove?: () => void;
};

/** Gaining blocks take the accent, losing blocks the cool tone. */
export function toneFor(strategy: CustomBlock['strategy']): string {
  const balance = strategyProfile(strategy).energyBalancePct;
  if (balance > 0) return colors.accent;
  if (balance < 0) return colors.info;
  return colors.textSecondary;
}

export function BlockBar({ block, weeksElsewhere, onChange, onPressLabel, onRemove }: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const limit = limitsFor(block.strategy);

  // How far this block may be dragged, in weeks.
  const ceiling = Math.max(limit.min, Math.min(limit.max, MAX_TOTAL_WEEKS - weeksElsewhere));

  const weeks = useSharedValue(block.weeks);
  const dragging = useSharedValue(0);

  const pixelsPerWeek = trackWidth > 0 ? trackWidth / MAX_TOTAL_WEEKS : 0;

  const pan = Gesture.Pan()
    .onBegin(() => {
      // Reactions land rather than bounce, per the motion rules.
      dragging.value = withTiming(1, { duration: motion.duration.instant, easing: motion.easing.out });
    })
    .onUpdate((event) => {
      if (pixelsPerWeek === 0) return;
      const next = block.weeks + event.translationX / pixelsPerWeek;
      const clamped = Math.round(Math.min(ceiling, Math.max(limit.min, next)));
      if (clamped !== weeks.value) {
        weeks.value = clamped;
        // Recalculate as it moves, not when it is let go.
        runOnJS(onChange)(clamped);
      }
    })
    .onFinalize(() => {
      dragging.value = withTiming(0, { duration: motion.duration.fast, easing: motion.easing.out });
    });

  const fill = useAnimatedStyle(() => ({
    width: `${(block.weeks / MAX_TOTAL_WEEKS) * 100}%`,
    transform: [{ scaleY: 1 + dragging.value * 0.12 }],
  }));

  const tone = toneFor(block.strategy);
  const profile = strategyProfile(block.strategy);

  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <Animated.View style={styles.label} onTouchEnd={onPressLabel}>
          <View style={[styles.swatch, { backgroundColor: tone }]} />
          <Text variant="bodySmall">{profile.label}</Text>
          <Icon name="chevronDown" size={14} color={colors.textTertiary} />
        </Animated.View>

        <View style={styles.weeks}>
          <Text variant="body" mono style={{ color: tone }}>
            {`${block.weeks}w`}
          </Text>
          {onRemove ? (
            <Animated.View onTouchEnd={onRemove} style={styles.remove}>
              <Icon name="close" size={14} color={colors.textTertiary} />
            </Animated.View>
          ) : null}
        </View>
      </View>

      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={onLayout}>
          {/* Where this block is not allowed to go. */}
          <View style={[styles.forbidden, { width: `${(limit.min / MAX_TOTAL_WEEKS) * 100}%` }]} />
          <View
            style={[
              styles.forbidden,
              styles.forbiddenRight,
              { width: `${((MAX_TOTAL_WEEKS - ceiling) / MAX_TOTAL_WEEKS) * 100}%` },
            ]}
          />
          <Animated.View style={[styles.fill, { backgroundColor: tone }, fill]}>
            <View style={styles.grip} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  weeks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  remove: {
    padding: spacing.xs,
  },
  track: {
    height: 34,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  forbidden: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    opacity: opacity.disabled,
  },
  forbiddenRight: {
    left: undefined,
    right: 0,
  },
  fill: {
    height: '100%',
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: spacing.sm,
  },
  grip: {
    width: 3,
    height: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    opacity: 0.5,
  },
});
