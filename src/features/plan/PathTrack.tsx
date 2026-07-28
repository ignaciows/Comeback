import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { Ramp } from '@/domain/plan/ramp';
import { formatShortDate } from '@/utils/date';

/**
 * The road ahead, week by week.
 *
 * Each stop is a week, and the dots on it are the sessions that week asks for.
 * Filled dots are sessions done. The point is that "what do I have to do" is
 * answered by counting circles rather than by reading a paragraph — and that
 * the early weeks visibly ask for less, so a five-day plan does not look like
 * a wall on day one.
 */

export type PathWeek = {
  /** Monday of the week. */
  startsOn: string;
  /** Sessions this week asks for. */
  required: number;
  /** Sessions actually completed. */
  completed: number;
  state: 'done' | 'current' | 'ahead';
};

type Props = {
  weeks: PathWeek[];
  style?: ViewStyle;
};

function Dot({ filled, current }: { filled: boolean; current: boolean }) {
  const beat = useLoop(motion.loop.heartbeat);

  // The unfilled dots of the current week breathe — what is still to do this
  // week is the only thing on this screen that moves.
  const pulse = useAnimatedStyle(() => ({
    opacity: current && !filled ? 0.35 + Math.sin(beat.value * Math.PI) * 0.4 : 1,
  }));

  return <Animated.View style={[styles.dot, filled ? styles.dotFilled : null, pulse]} />;
}

export function PathTrack({ weeks, style }: Props) {
  return (
    <View style={style}>
      {weeks.map((week, index) => {
        const isCurrent = week.state === 'current';
        const complete = week.completed >= week.required;

        return (
          <Animated.View key={week.startsOn} entering={FadeIn.delay(index * 40)} style={styles.stop}>
            {/* The line joining one week to the next. */}
            <View style={styles.rail}>
              <View
                style={[
                  styles.node,
                  complete ? styles.nodeDone : null,
                  isCurrent ? styles.nodeCurrent : null,
                ]}
              >
                <Text variant="caption" tone={complete || isCurrent ? 'primary' : 'tertiary'} mono>
                  {week.required}
                </Text>
              </View>
              {index < weeks.length - 1 ? (
                <View style={[styles.line, complete ? styles.lineDone : null]} />
              ) : null}
            </View>

            <View style={styles.body}>
              <View style={styles.headline}>
                <Text variant="bodySmall" tone={week.state === 'ahead' ? 'tertiary' : 'primary'}>
                  {isCurrent ? 'This week' : formatShortDate(week.startsOn)}
                </Text>
                {complete && week.state !== 'ahead' ? <Label>done</Label> : null}
              </View>

              <View style={styles.dots}>
                {Array.from({ length: week.required }, (_, dotIndex) => (
                  <Dot key={dotIndex} filled={dotIndex < week.completed} current={isCurrent} />
                ))}
              </View>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/**
 * Turns the ramp and the sessions logged into the weeks to draw.
 *
 * Only a short window is shown — enough to see the climb, not so much that it
 * becomes a wall of future obligations.
 */
export function pathWeeksFrom(
  ramp: Ramp,
  completedByWeek: Map<string, number>,
  currentWeekStart: string,
  count = 6,
): PathWeek[] {
  const currentIndex = ramp.steps.findIndex((step) => step.startsOn === currentWeekStart);
  const start = Math.max(0, currentIndex - 1);

  return ramp.steps.slice(start, start + count).map((step) => ({
    startsOn: step.startsOn,
    required: step.sessions,
    completed: completedByWeek.get(step.startsOn) ?? 0,
    state:
      step.startsOn === currentWeekStart
        ? ('current' as const)
        : step.startsOn < currentWeekStart
          ? ('done' as const)
          : ('ahead' as const),
  }));
}

const styles = StyleSheet.create({
  stop: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  rail: {
    alignItems: 'center',
    width: 32,
  },
  node: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
  },
  nodeCurrent: {
    borderColor: colors.accent,
  },
  line: {
    flex: 1,
    width: borderWidth.hairline * 2,
    minHeight: spacing.xl,
    backgroundColor: colors.border,
  },
  lineDone: {
    backgroundColor: colors.accentMuted,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.borderStrong,
  },
  dotFilled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
});
