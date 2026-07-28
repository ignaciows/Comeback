import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import type { NextStep } from '@/domain/nextStep';

/**
 * Where to press.
 *
 * A screen of rows is only navigable by someone who already knows what is in
 * it. This is the app choosing on the user's behalf: one card, one action, the
 * reason underneath it in a single line.
 *
 * It glows gently while it is the outstanding thing to do, which is the only
 * place in the app where something asks for attention rather than waiting to
 * be found.
 */

type Props = {
  step: NextStep;
  onPress: () => void;
  /** Position in a setup list, when there is more than one thing left. */
  index?: number;
  total?: number;
  style?: ViewStyle;
};

export function NextStepCard({ step, onPress, index, total, style }: Props) {
  const beat = useLoop(motion.loop.breathe);

  const glow = useAnimatedStyle(() => ({
    opacity: 0.55 + Math.sin(beat.value * Math.PI) * 0.45,
  }));

  return (
    <Animated.View entering={FadeIn.duration(motion.duration.reveal)} style={style}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${step.label}. ${step.why}`}
        style={({ pressed }) => [styles.card, pressed && { opacity: opacity.pressed }]}
      >
        <View style={styles.head}>
          <View style={styles.badge}>
            <Animated.View style={[styles.badgeGlow, glow]} />
            <Icon name={step.icon} size={20} color={colors.accent} />
          </View>

          {total && total > 1 && index !== undefined ? (
            <Label>{`${index + 1} of ${total}`}</Label>
          ) : (
            <Label>{step.kind === 'setup' ? 'To set up' : 'Next'}</Label>
          )}
        </View>

        <Text variant="heading" style={styles.label}>
          {step.label}
        </Text>
        <Text variant="bodySmall" tone="secondary">
          {step.why}
        </Text>

        <View style={styles.go}>
          <Text variant="bodySmall" style={styles.goText}>
            Open
          </Text>
          <Icon name="chevronRight" size={16} color={colors.accent} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** The remaining setup, so the end of it is visible. */
export function SetupList({
  steps,
  onPress,
  style,
}: {
  steps: NextStep[];
  onPress: (step: NextStep) => void;
  style?: ViewStyle;
}) {
  if (steps.length === 0) return null;

  return (
    <View style={style}>
      <NextStepCard step={steps[0]} onPress={() => onPress(steps[0])} index={0} total={steps.length} />

      {steps.slice(1).map((step) => (
        <Pressable
          key={step.id}
          onPress={() => onPress(step)}
          accessibilityRole="button"
          accessibilityLabel={step.label}
          style={({ pressed }) => [styles.pending, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name={step.icon} size={16} color={colors.textTertiary} />
          <Text variant="bodySmall" tone="tertiary" style={styles.pendingLabel}>
            {step.label}
          </Text>
          <Icon name="chevronRight" size={14} color={colors.textTertiary} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSurface,
    borderWidth: borderWidth.hairline,
    borderColor: colors.accentMuted,
  },
  label: {
    fontSize: 24,
    lineHeight: 28,
  },
  go: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  goText: {
    color: colors.accent,
  },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pendingLabel: {
    flex: 1,
  },
});
