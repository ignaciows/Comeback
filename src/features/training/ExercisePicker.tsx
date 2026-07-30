import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Input } from '@/components/Input';
import { Text } from '@/design-system/Text';
import { colors, opacity, radius, spacing } from '@/design-system/tokens';
import { EXERCISES, searchExercises } from '@/data/exercises';

/**
 * Picking a movement to add, from anywhere it is needed.
 *
 * Both session screens can add an exercise mid-workout — the list view and the
 * guided one — and the failure mode of writing it twice is that the two drift:
 * one gets a search box, the other gets a filter, and which one you are looking
 * at changes what you can do. One implementation.
 */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
  title = 'Add exercise',
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  title?: string;
}) {
  const [query, setQuery] = useState('');

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={close} title={title}>
      <Input value={query} onChangeText={setQuery} placeholder="Search" autoCorrect={false} />

      <View style={styles.list}>
        {(query ? searchExercises(query) : EXERCISES).slice(0, 40).map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => {
              onPick(exercise.id);
              close();
            }}
            accessibilityRole="button"
            accessibilityLabel={exercise.name}
            style={({ pressed }) => [styles.option, pressed && { opacity: opacity.pressed }]}
          >
            <View style={styles.optionText}>
              <Text variant="body">{exercise.name}</Text>
              <Text variant="caption" tone="tertiary">
                {exercise.primaryMuscle}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.lg,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  optionText: {
    gap: spacing.xs,
  },
});
