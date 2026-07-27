import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';

type Props = {
  label: string;
  /** 1..5 */
  value: number | null;
  onChange: (value: number) => void;
  /** Text for the extremes, e.g. ['Drained', 'Fresh']. */
  anchors: [string, string];
  style?: ViewStyle;
};

const LEVELS = [1, 2, 3, 4, 5];

/** Five-step rating used across the daily check-in. One tap, no dragging. */
export function Scale({ label, value, onChange, anchors, style }: Props) {
  return (
    <View style={style}>
      <Label style={styles.label}>{label}</Label>
      <View style={styles.row}>
        {LEVELS.map((level) => {
          const selected = value === level;
          return (
            <Pressable
              key={level}
              onPress={() => onChange(level)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${label}: ${level} of 5`}
              style={({ pressed }) => [
                styles.step,
                selected && styles.stepSelected,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Text variant="bodySmall" tone={selected ? 'primary' : 'tertiary'} mono>
                {level}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.anchors}>
        <Text variant="caption" tone="tertiary">
          {anchors[0]}
        </Text>
        <Text variant="caption" tone="tertiary">
          {anchors[1]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  step: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stepSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  anchors: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
});
