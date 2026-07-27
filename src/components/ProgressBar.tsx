import { StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius } from '@/design-system/tokens';

type Props = {
  /** 0..1 */
  value: number;
  /** Optional second, lighter track segment (e.g. planned vs completed). */
  secondaryValue?: number;
  color?: string;
  height?: number;
  label?: string;
  style?: ViewStyle;
};

export function ProgressBar({
  value,
  secondaryValue,
  color = colors.accent,
  height = 4,
  label,
  style,
}: Props) {
  const clamped = Math.max(0, Math.min(1, value));
  const clampedSecondary = secondaryValue === undefined ? null : Math.max(0, Math.min(1, secondaryValue));
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ now: Math.round(clamped * 100), min: 0, max: 100 }}
    >
      {clampedSecondary !== null ? (
        <View
          style={[
            styles.fill,
            { width: `${clampedSecondary * 100}%`, backgroundColor: colors.borderStrong, borderRadius: height / 2 },
          ]}
        />
      ) : null}
      <View
        style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: color, borderRadius: height / 2 }]}
      />
    </View>
  );
}

/** Discrete week strip: one mark per planned day. */
export function DayStrip({
  days,
  style,
}: {
  days: { key: string; state: 'completed' | 'planned' | 'missed' | 'rest' | 'today' }[];
  style?: ViewStyle;
}) {
  const tone = {
    completed: colors.accent,
    planned: colors.borderStrong,
    missed: colors.danger,
    rest: colors.border,
    today: colors.textSecondary,
  };
  return (
    <View style={[styles.strip, style]}>
      {days.map((day) => (
        <View key={day.key} style={[styles.stripItem, { backgroundColor: tone[day.state] }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  strip: {
    flexDirection: 'row',
    gap: 4,
  },
  stripItem: {
    flex: 1,
    height: 4,
    borderRadius: radius.sm,
  },
});
