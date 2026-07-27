import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { colors, layout, spacing } from '@/design-system/tokens';

type Props = {
  children: ReactNode;
  /** Scrollable by default; set false for screens that own their own scrolling. */
  scroll?: boolean;
  /** Extra bottom padding, e.g. to clear a docked action. */
  bottomInset?: number;
  padded?: boolean;
  /** Renders the time-of-day glow behind the content. */
  ambient?: boolean;
  style?: ViewStyle;
};

/**
 * Page shell: background, safe areas and horizontal rhythm. Every route renders
 * inside one of these.
 */
export function Screen({
  children,
  scroll = true,
  bottomInset = 0,
  padded = true,
  ambient = false,
  style,
}: Props) {
  const insets = useSafeAreaInsets();
  const paddingTop = insets.top + spacing.sm;
  const paddingBottom = insets.bottom + spacing.xl + bottomInset;
  const horizontal = padded ? layout.screenPadding : 0;

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop, paddingHorizontal: horizontal }, style]}>
        {ambient ? <AmbientBackground /> : null}
        {children}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {ambient ? <AmbientBackground /> : null}
      <ScrollView
        style={styles.root}
        contentContainerStyle={[{ paddingTop, paddingBottom, paddingHorizontal: horizontal }, style]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
