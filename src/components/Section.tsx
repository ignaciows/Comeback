import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { colors, layout, opacity, spacing } from '@/design-system/tokens';

type Props = {
  title?: string;
  /** Optional right-hand action rendered as a quiet text button. */
  action?: { label: string; onPress: () => void };
  footnote?: string;
  children: ReactNode;
  style?: ViewStyle;
};

/**
 * A titled block. Separation comes from space and a label, not from another
 * rounded rectangle.
 */
export function Section({ title, action, footnote, children, style }: Props) {
  return (
    <View style={[styles.root, style]}>
      {(title || action) && (
        <View style={styles.head}>
          {title ? <Label>{title}</Label> : <View />}
          {action ? (
            <Pressable
              onPress={action.onPress}
              hitSlop={layout.hitSlop}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, pressed && { opacity: opacity.pressed }]}
            >
              <Text variant="bodySmall" tone="secondary">
                {action.label}
              </Text>
              <Icon name="chevronRight" size={14} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </View>
      )}
      {children}
      {footnote ? (
        <Text variant="caption" tone="tertiary" style={styles.footnote}>
          {footnote}
        </Text>
      ) : null}
    </View>
  );
}

/** Full-bleed hairline used between rows. */
export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

const styles = StyleSheet.create({
  root: {
    marginBottom: spacing.xxl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footnote: {
    marginTop: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
