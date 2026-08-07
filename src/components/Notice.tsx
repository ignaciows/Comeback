import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import type { Attention } from '@/domain/attention';

/**
 * One thing the app noticed, drawn as a card rather than a row.
 *
 * The shape is the message. A row in a list says "here is somewhere you could
 * go"; a card with its own surface, its own glyph and its own colour says
 * "this is the thing". They cannot be the same component, because the moment a
 * notice looks like navigation it becomes navigation — one more line to skim
 * past on the way to the button.
 *
 * When there is more than one, the others are counted rather than listed. A
 * number is an invitation to look; five stacked cards are a wall.
 */

export function Notice({
  item,
  more = 0,
  onPress,
  onPressMore,
  style,
}: {
  item: Attention;
  /** How many others are waiting behind this one. */
  more?: number;
  onPress: () => void;
  onPressMore?: () => void;
  style?: ViewStyle;
}) {
  const tint = item.tone === 'warning' ? colors.warning : colors.accent;
  const surface = item.tone === 'warning' ? colors.warningSurface : colors.accentSurface;

  return (
    <View style={style}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${item.headline}. ${item.detail}`}
        style={({ pressed }) => [
          styles.card,
          { borderColor: tint, backgroundColor: surface },
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <View style={[styles.glyph, { backgroundColor: colors.background }]}>
          <Icon name={item.icon} size={20} color={tint} />
        </View>

        <View style={styles.body}>
          <Text variant="heading">{item.headline}</Text>
          <Text variant="bodySmall" tone="secondary" style={styles.detail}>
            {item.detail}
          </Text>
        </View>

        <Icon name="chevronRight" size={16} color={tint} />
      </Pressable>

      {more > 0 && onPressMore ? (
        <Pressable
          onPress={onPressMore}
          accessibilityRole="button"
          style={({ pressed }) => [styles.more, pressed && { opacity: opacity.pressed }]}
        >
          <Label>{`${more} more ${more === 1 ? 'thing' : 'things'}`}</Label>
          <Icon name="chevronRight" size={13} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
  },
  glyph: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  detail: {
    marginTop: 2,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
});
