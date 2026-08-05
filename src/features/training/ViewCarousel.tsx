import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { viewsFor } from '@/data/movementViews';
import { VIEW_ART } from '@/features/training/viewArt';

/**
 * The same lift from the angles that answer different questions.
 *
 * A gallery of pictures teaches nothing; a picture with the reason it exists
 * teaches the thing the angle was chosen for. So each view carries its caption
 * — "the only angle that settles the elbow question" — and the tabs are named
 * after positions rather than numbered, because "the bottom" and "locked out"
 * are what someone is actually looking for.
 */
export function ViewCarousel({ exerciseId }: { exerciseId: string }) {
  const views = viewsFor(exerciseId).filter((view) => VIEW_ART[view.id]);
  const [active, setActive] = useState(0);

  if (views.length === 0) return null;
  const view = views[Math.min(active, views.length - 1)];

  return (
    <View>
      <Image
        source={VIEW_ART[view.id]}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel={`${view.label}: ${view.why}`}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
      >
        {views.map((entry, index) => {
          const on = index === active;
          return (
            <Pressable
              key={entry.id}
              onPress={() => {
                Haptics.selectionAsync();
                setActive(index);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.tab,
                on && styles.tabOn,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Text variant="bodySmall" style={on ? styles.tabTextOn : undefined}>
                {entry.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* The caption is the point. Without it this is a slideshow. */}
      <Label style={styles.whyLabel}>What this angle shows</Label>
      <Text variant="bodySmall" tone="secondary">
        {view.why}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  tabs: {
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  tabOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  tabTextOn: {
    color: colors.accent,
  },
  whyLabel: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
});
