import { useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

import { StatusPill } from '@/components/Feedback';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { borderWidth, colors, opacity, spacing } from '@/design-system/tokens';
import type { PlanPhaseView } from '@/domain/plan/phases';
import { formatLongDate } from '@/utils/date';

/**
 * The road, in stretches you can be part-way through.
 *
 * Every day of the plan is a mark, but the marks are grouped by phase, so a
 * three-hundred-day plan reads as six things rather than as an ocean. A phase
 * you have finished is filled, the one you are in fills as it goes, and the
 * ones ahead sit dark — visibly waiting.
 *
 * Opening a phase says what it does to you, including the unflattering part.
 * Someone told in advance that they will look softer in week nine does not
 * quit in week nine.
 */

type Props = {
  phases: PlanPhaseView[];
  style?: ViewStyle;
};

/** Above this many days a mark stands for more than one day. */
const MAX_MARKS = 28;

function PhaseDots({ phase }: { phase: PlanPhaseView }) {
  const beat = useLoop(motion.loop.breathe);

  const perMark = Math.max(1, Math.ceil(phase.days / MAX_MARKS));
  const total = Math.ceil(phase.days / perMark);
  const done = Math.floor(phase.daysDone / perMark);

  const pulse = useAnimatedStyle(() => ({
    opacity: phase.state === 'current' ? 0.4 + Math.sin(beat.value * Math.PI) * 0.35 : 1,
  }));

  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, index) => {
        const filled = index < done;
        const isNext = phase.state === 'current' && index === done;

        return (
          <Animated.View
            key={index}
            style={[
              styles.dot,
              filled ? styles.dotFilled : null,
              isNext ? [styles.dotNext, pulse] : null,
            ]}
          />
        );
      })}
    </View>
  );
}

export function PhaseTrack({ phases, style }: Props) {
  const [open, setOpen] = useState<number | null>(
    () => phases.find((phase) => phase.state === 'current')?.index ?? null,
  );

  return (
    <View style={style}>
      {phases.map((phase, index) => {
        const expanded = open === phase.index;
        const ahead = phase.state === 'ahead';

        return (
          <Animated.View key={`${phase.startsOn}-${phase.index}`} entering={FadeIn.delay(index * 40)}>
            <Pressable
              onPress={() => setOpen(expanded ? null : phase.index)}
              accessibilityRole="button"
              accessibilityLabel={`${phase.label}, ${phase.days} days`}
              style={({ pressed }) => [styles.phase, pressed && { opacity: opacity.pressed }]}
            >
              <View style={styles.head}>
                <View style={styles.title}>
                  <Text variant="body" tone={ahead ? 'tertiary' : 'primary'}>
                    {phase.label}
                  </Text>
                  {phase.state === 'current' ? <StatusPill label="Now" tone="accent" /> : null}
                  {phase.state === 'done' ? <Label>done</Label> : null}
                </View>

                <View style={styles.meta}>
                  <Text variant="caption" tone="tertiary" mono>
                    {phase.state === 'current'
                      ? `${phase.days - phase.daysDone} left`
                      : `${phase.days} days`}
                  </Text>
                  <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} color={colors.textTertiary} />
                </View>
              </View>

              <PhaseDots phase={phase} />

              {expanded ? (
                <Animated.View entering={FadeIn.duration(motion.duration.base)} style={styles.body}>
                  <Text variant="bodySmall" tone="secondary">
                    {phase.story}
                  </Text>
                  <View style={styles.facts}>
                    <Text variant="caption" tone="tertiary" mono>
                      {`${formatLongDate(phase.startsOn)} → ${formatLongDate(phase.endsOn)}`}
                    </Text>
                    <Text variant="caption" tone="tertiary" mono>
                      {`${phase.kcal} kcal`}
                    </Text>
                  </View>
                  {phase.sessionsDone > 0 ? (
                    <Label>{`${phase.sessionsDone} sessions logged here`}</Label>
                  ) : null}
                </Animated.View>
              ) : null}
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  phase: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    borderWidth: borderWidth.hairline,
    borderColor: colors.borderStrong,
  },
  dotFilled: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dotNext: {
    backgroundColor: colors.accentSurface,
    borderColor: colors.accent,
  },
  body: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  facts: {
    flexDirection: 'row',
    gap: spacing.lg,
    flexWrap: 'wrap',
  },
});
