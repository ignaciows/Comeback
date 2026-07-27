import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, layout, opacity, radius, spacing } from '@/design-system/tokens';

type BaseProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: ViewStyle;
  /** Full width by default; set false for inline placement. */
  block?: boolean;
};

/** The one obvious action of a screen. */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  style,
  block = true,
}: BaseProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.base,
        styles.primary,
        block && styles.block,
        pressed && !inactive && { opacity: opacity.pressed },
        inactive && { opacity: opacity.disabled },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.textInverse} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={colors.textInverse} /> : null}
          <Text variant="heading" tone="inverse">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Secondary action: outlined, never competing with the primary one. */
export function SecondaryButton({
  label,
  onPress,
  disabled,
  loading,
  icon,
  style,
  block = true,
  tone = 'neutral',
}: BaseProps & { tone?: 'neutral' | 'danger' }) {
  const inactive = disabled || loading;
  const color = tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      style={({ pressed }) => [
        styles.base,
        styles.secondary,
        tone === 'danger' && { borderColor: colors.dangerSurface },
        block && styles.block,
        pressed && !inactive && { opacity: opacity.pressed },
        inactive && { opacity: opacity.disabled },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color} size="small" />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={color} /> : null}
          <Text variant="heading" style={{ color }}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Quiet text action for tertiary paths. */
export function TextButton({
  label,
  onPress,
  disabled,
  style,
}: Pick<BaseProps, 'label' | 'onPress' | 'disabled' | 'style'>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={layout.hitSlop}
      style={({ pressed }) => [
        styles.textButton,
        pressed && { opacity: opacity.pressed },
        disabled && { opacity: opacity.disabled },
        style,
      ]}
    >
      <Text variant="body" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'neutral',
  size = 20,
  disabled,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  /** Accessibility label — required, these buttons have no text. */
  label: string;
  tone?: 'neutral' | 'accent' | 'danger';
  size?: number;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const color =
    tone === 'accent' ? colors.accent : tone === 'danger' ? colors.danger : colors.textSecondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={layout.hitSlop}
      style={({ pressed }) => [
        styles.iconButton,
        pressed && { opacity: opacity.pressed },
        disabled && { opacity: opacity.disabled },
        style,
      ]}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** Docked action area pinned above the safe-area inset. */
export function ActionBar({ children }: { children: React.ReactNode }) {
  return <View style={styles.actionBar}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
  },
  block: {
    alignSelf: 'stretch',
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    borderWidth: borderWidth.hairline,
    borderColor: colors.borderStrong,
  },
  textButton: {
    paddingVertical: spacing.sm,
  },
  iconButton: {
    padding: spacing.xs,
  },
  actionBar: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
