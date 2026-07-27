import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { colors, layout, opacity, spacing } from '@/design-system/tokens';

type Props = {
  title: string;
  subtitle?: string;
  /** Left affordance, typically a back or close action. */
  leading?: { icon: IconName; onPress: () => void; label: string };
  trailing?: ReactNode;
};

export function Header({ title, subtitle, leading, trailing }: Props) {
  return (
    <View style={styles.root}>
      {leading ? (
        <Pressable
          onPress={leading.onPress}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={leading.label}
          style={({ pressed }) => [styles.leading, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name={leading.icon} color={colors.textSecondary} />
        </Pressable>
      ) : null}
      <View style={styles.titles}>
        <Text variant="title">{title}</Text>
        {subtitle ? (
          <Text variant="bodySmall" tone="secondary" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  leading: {
    marginRight: spacing.md,
  },
  titles: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  trailing: {
    marginLeft: spacing.md,
  },
});
