import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { SecondaryButton } from './Button';

type StatusTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'info';

const pillTones: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceRaised, fg: colors.textSecondary },
  accent: { bg: colors.accentSurface, fg: colors.accent },
  warning: { bg: colors.warningSurface, fg: colors.warning },
  danger: { bg: colors.dangerSurface, fg: colors.danger },
  info: { bg: colors.infoSurface, fg: colors.info },
};

export function StatusPill({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: StatusTone;
  style?: ViewStyle;
}) {
  const { bg, fg } = pillTones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text variant="label" uppercase style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Shown wherever a model cannot yet say anything meaningful. Always names the
 * missing data and offers the action that fixes it.
 */
export function EmptyState({
  title,
  description,
  action,
  style,
}: {
  title: string;
  description: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.empty, style]}>
      <Text variant="heading">{title}</Text>
      <Text variant="bodySmall" tone="secondary" style={styles.emptyBody}>
        {description}
      </Text>
      {action ? (
        <SecondaryButton label={action.label} onPress={action.onPress} block={false} style={styles.emptyAction} />
      ) : null}
    </View>
  );
}

export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <View style={styles.centered} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <View style={[styles.empty, styles.error]}>
      <Text variant="heading" tone="danger">
        {title}
      </Text>
      <Text variant="bodySmall" tone="secondary" style={styles.emptyBody}>
        {description}
      </Text>
      {onRetry ? (
        <SecondaryButton label="Try again" onPress={onRetry} block={false} style={styles.emptyAction} />
      ) : null}
    </View>
  );
}

/** Inline explanation of what a number means or why it is uncertain. */
export function Note({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.note, style]}>
      <Text variant="caption" tone="tertiary">
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  empty: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  error: {
    borderColor: colors.dangerSurface,
  },
  emptyBody: {
    marginTop: spacing.sm,
  },
  emptyAction: {
    marginTop: spacing.lg,
  },
  centered: {
    paddingVertical: spacing.xxxl,
    alignItems: 'center',
  },
  note: {
    borderLeftWidth: borderWidth.thick,
    borderLeftColor: colors.border,
    paddingLeft: spacing.md,
  },
});
