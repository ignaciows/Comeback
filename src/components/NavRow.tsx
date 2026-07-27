import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';

type Props = {
  label: string;
  /** The one number or word that answers the row. */
  value?: string;
  /** Small line under the label. Use rarely — the row should read at a glance. */
  detail?: string;
  onPress: () => void;
  tone?: 'neutral' | 'accent' | 'warning';
  /** Left-hand status dot; omit for plain rows. */
  dot?: boolean;
};

/**
 * The app's main navigation unit: label on the left, the answer on the right,
 * a chevron. Screens are lists of these, and detail lives one tap deeper —
 * nothing is explained on a screen that only needed to point somewhere.
 */
export function NavRow({ label, value, detail, onPress, tone = 'neutral', dot = false }: Props) {
  const valueColor =
    tone === 'accent' ? colors.accent : tone === 'warning' ? colors.warning : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && { opacity: opacity.pressed }]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: valueColor }]} /> : null}
      <View style={styles.labels}>
        <Text variant="body">{label}</Text>
        {detail ? (
          <Text variant="caption" tone="tertiary" style={styles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" mono style={{ color: valueColor }}>
          {value}
        </Text>
      ) : null}
      <Icon name="chevronRight" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

/** A group of rows sharing one surface. */
export function NavGroup({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.group, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  group: {
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  labels: {
    flex: 1,
  },
  detail: {
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
