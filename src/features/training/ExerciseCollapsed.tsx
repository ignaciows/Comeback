import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { colors, opacity, radius, spacing } from '@/design-system/tokens';
import { exerciseName } from '@/data/exercises';
import type { ExerciseFocus } from '@/domain/training/sessionFocus';

type Props = {
  item: ExerciseFocus;
  onPress: () => void;
};

/**
 * An exercise you are not doing right now, in one line.
 *
 * Done rows are ticked and dimmed — they are there so the session reads as
 * shrinking, not so you can study them. Upcoming rows carry only the shape of
 * the work, because a set table for a movement four exercises away is noise
 * you have to scroll past to reach the one you are on.
 *
 * Tapping opens it anyway. Collapsing is about what is loud by default, not
 * about taking anything away.
 */
export function ExerciseCollapsed({ item, onPress }: Props) {
  const done = item.state === 'done';
  const skipped = item.state === 'skipped';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${exerciseName(item.exerciseId)}, ${item.setsDone} of ${item.setsPlanned} sets. Open.`}
      style={({ pressed }) => [styles.root, pressed && { opacity: opacity.pressed }]}
    >
      <View style={[styles.mark, done && styles.markDone]}>
        {done ? <Icon name="check" size={11} color={colors.background} /> : null}
      </View>

      <View style={styles.body}>
        <Text
          variant="body"
          tone={done || skipped ? 'tertiary' : 'primary'}
          style={skipped ? styles.struck : undefined}
          numberOfLines={1}
        >
          {exerciseName(item.exerciseId)}
        </Text>
      </View>

      <Text variant="bodySmall" mono tone="tertiary">
        {skipped ? 'skipped' : (item.summary ?? '—')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  mark: {
    width: 18,
    height: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  body: {
    flex: 1,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
});
