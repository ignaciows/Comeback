import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { colors, radius, spacing } from '@/design-system/tokens';

type Props = {
  /** Sessions already logged towards the goal. */
  completed: number;
  /** Sessions still to do. Null when there is no target to count towards. */
  remaining: number | null;
  /** What the count is counting towards, e.g. "78.0 kg". */
  targetLabel: string;
  /** Shown under the track, e.g. "Target 4 December". */
  footnote?: string;
};

/** Above this, one mark per session is unreadable, so a mark becomes a week. */
const MAX_INDIVIDUAL = 56;

/**
 * The filled-in track: one mark per session done, empty marks for what is left
 * between here and the goal. It answers "how much is still ahead of me" at a
 * glance, which a date alone never does.
 */
export function MilestoneTrack({ completed, remaining, targetLabel, footnote }: Props) {
  const beat = useLoop(motion.loop.heartbeat);

  const { marks, unit, perMark } = useMemo(() => {
    const total = completed + (remaining ?? 0);
    if (remaining === null) {
      return { marks: { done: completed, left: 0, total: completed }, unit: 'sessions', perMark: 1 };
    }
    if (total <= MAX_INDIVIDUAL) {
      return { marks: { done: completed, left: remaining, total }, unit: 'sessions', perMark: 1 };
    }
    // Compress to weeks once the session count stops fitting on screen.
    const perWeek = Math.ceil(total / MAX_INDIVIDUAL);
    return {
      marks: {
        done: Math.floor(completed / perWeek),
        left: Math.ceil(remaining / perWeek),
        total: Math.ceil(total / perWeek),
      },
      unit: 'sessions',
      perMark: perWeek,
    };
  }, [completed, remaining]);

  // The mark being worked on right now breathes, so the track reads as live.
  const current = useAnimatedStyle(() => ({
    opacity: interpolate(beat.value, [0, 1], [0.45, 1]),
  }));

  return (
    <View>
      <View style={styles.head}>
        <View style={styles.count}>
          <AnimatedNumber value={completed} variant="metric" />
          <Text variant="bodySmall" tone="tertiary">
            {remaining === null ? `${unit} logged` : `of ${completed + remaining} ${unit}`}
          </Text>
        </View>
        <View style={styles.target}>
          <Label>Towards</Label>
          <Text variant="body" tone="secondary">
            {targetLabel}
          </Text>
        </View>
      </View>

      <View style={styles.track}>
        {Array.from({ length: marks.done }, (_, index) => (
          <View key={`done-${index}`} style={[styles.mark, styles.markDone]} />
        ))}
        {marks.left > 0 ? (
          <Animated.View style={[styles.mark, styles.markCurrent, current]} />
        ) : null}
        {Array.from({ length: Math.max(0, marks.left - 1) }, (_, index) => (
          <View key={`left-${index}`} style={styles.mark} />
        ))}
      </View>

      <View style={styles.legend}>
        <Text variant="caption" tone="tertiary">
          {remaining === null
            ? 'Set a target weight to see what is left'
            : `${remaining} to go${perMark > 1 ? ` · one mark = ${perMark} sessions` : ''}`}
        </Text>
        {footnote ? (
          <Text variant="caption" tone="tertiary">
            {footnote}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  target: {
    alignItems: 'flex-end',
    gap: 2,
  },
  track: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  mark: {
    width: 12,
    height: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  markDone: {
    backgroundColor: colors.accent,
  },
  markCurrent: {
    backgroundColor: colors.accentMuted,
  },
  legend: {
    marginTop: spacing.md,
    gap: 2,
  },
});
