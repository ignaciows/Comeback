import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import type { WeekPlan } from '@/domain/plan/week';

/**
 * The week, in one row of seven.
 *
 * The point is that nobody should have to reconstruct where they are from a
 * list of sessions. Seven marks, each obviously one of five things, and the
 * sentence underneath says what the app has decided to do about it.
 *
 * Missed days are drawn plainly rather than in red. A day that did not happen
 * is information the plan has already reacted to — it has moved the sessions
 * — and colouring it like an error would be telling someone off for something
 * that is already handled.
 */

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function WeekStrip({
  plan,
  onPress,
  style,
}: {
  plan: WeekPlan;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${plan.headline}. ${plan.detail}`}
      style={({ pressed }) => [styles.wrap, pressed && onPress ? { opacity: opacity.pressed } : null, style]}
    >
      <View style={styles.head}>
        <Text variant="body">{plan.headline}</Text>
        {onPress ? <Icon name="chevronRight" size={14} color={colors.textTertiary} /> : null}
      </View>

      <View style={styles.row}>
        {plan.days.map((day) => (
          <View key={day.date} style={styles.day}>
            <Text variant="caption" tone="tertiary">
              {LETTERS[day.weekday]}
            </Text>

            <View
              style={[
                styles.mark,
                day.state === 'done' && styles.done,
                day.state === 'today' && styles.today,
                day.state === 'planned' && styles.planned,
                day.state === 'missed' && styles.missed,
              ]}
            >
              {day.state === 'done' ? <Icon name="check" size={11} color={colors.background} /> : null}
            </View>
          </View>
        ))}
      </View>

      <Text variant="caption" tone="tertiary" style={styles.detail}>
        {plan.detail}
      </Text>
    </Pressable>
  );
}

const MARK = 26;

const styles = StyleSheet.create({
  wrap: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  mark: {
    width: MARK,
    height: MARK,
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  done: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  today: {
    borderColor: colors.accent,
    borderWidth: borderWidth.thick,
    backgroundColor: colors.accentSurface,
  },
  planned: {
    borderColor: colors.textTertiary,
    borderStyle: 'dashed',
  },
  // Deliberately not red: the plan has already moved the sessions.
  missed: {
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.surfaceRaised,
  },
  detail: {
    lineHeight: 17,
  },
});
