import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';

/** A big number you can change without looking at your phone properly. */
export function Stepper({
  label,
  value,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number | null;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const nudge = (direction: -1 | 1) => {
    Haptics.selectionAsync();
    onChange(Math.max(0, Math.round(((value ?? 0) + direction * step) * 10) / 10));
  };

  return (
    <View style={styles.stepper}>
      <Label>{label}</Label>

      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => nudge(-1)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Less ${label}`}
          style={({ pressed }) => [styles.stepButton, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name="minus" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.stepperValue}>
          <AnimatedNumber
            value={value}
            decimals={value !== null && value % 1 !== 0 ? 1 : 0}
            variant="display"
            style={styles.stepperNumber}
          />
          {suffix ? (
            <Text variant="caption" tone="tertiary">
              {suffix}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => nudge(1)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`More ${label}`}
          style={({ pressed }) => [styles.stepButton, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name="plus" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  stepper: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 40,
    lineHeight: 44,
  },
});
