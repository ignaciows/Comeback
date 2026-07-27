import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon, type IconName } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { motion } from '@/design-system/motion';
import { borderWidth, colors, layout, opacity, radius, spacing } from '@/design-system/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Buttons settle under the finger rather than just changing opacity — the
 * press is the app's most frequent interaction, so it is the one that most
 * needs to feel physical.
 */
function usePressScale(amount = 0.97) {
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * (1 - amount) }],
  }));
  return {
    style,
    onPressIn: () => {
      pressed.value = withTiming(1, { duration: motion.duration.instant });
    },
    onPressOut: () => {
      pressed.value = withTiming(0, { duration: motion.duration.fast });
    },
  };
}

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
  const press = usePressScale();
  return (
    <AnimatedPressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.base,
        styles.primary,
        block && styles.block,
        inactive && { opacity: opacity.disabled },
        press.style,
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
    </AnimatedPressable>
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
  const press = usePressScale();
  return (
    <AnimatedPressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      style={[
        styles.base,
        styles.secondary,
        tone === 'danger' && { borderColor: colors.dangerSurface },
        block && styles.block,
        inactive && { opacity: opacity.disabled },
        press.style,
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
    </AnimatedPressable>
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
