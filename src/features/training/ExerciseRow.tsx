import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { StatusPill } from '@/components/Feedback';
import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { colors, opacity, radius, spacing } from '@/design-system/tokens';
import { EQUIPMENT_LABELS, MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { Exercise } from '@/domain/types';
import { MuscleMap, preferredView } from './MuscleMap';

/**
 * One exercise, at a glance.
 *
 * A beginner reading "Romanian deadlift · 3 × 8" learns nothing about what it
 * does to them. The figure on the left carries that: which muscle lights up is
 * the answer to "what is this for", before any word is read. It appears
 * everywhere an exercise is listed so the same picture always means the same
 * thing.
 */

type Props = {
  exercise: Exercise;
  /** e.g. "3 × 8–12". */
  prescription?: string;
  /** Overrides the default line of equipment and pattern. */
  detail?: string;
  onPress?: () => void;
  /** Shown on the right when the gym is known not to have the kit. */
  unavailable?: boolean;
  /** A second action, typically swapping the exercise out. */
  onSwap?: () => void;
  style?: ViewStyle;
};

export function ExerciseRow({
  exercise,
  prescription,
  detail,
  onPress,
  unavailable = false,
  onSwap,
  style,
}: Props) {
  const equipment = exercise.equipment
    .filter((item) => item !== 'bodyweight' || exercise.equipment.length === 1)
    .map((item) => EQUIPMENT_LABELS[item])
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${exercise.name}, works ${MUSCLE_GROUP_LABELS[exercise.primaryMuscle]}`}
      style={({ pressed }) => [styles.row, pressed && onPress ? { opacity: opacity.pressed } : null, style]}
    >
      <View style={styles.figure}>
        <MuscleMap
          primary={exercise.primaryMuscle}
          secondary={exercise.secondaryMuscles}
          view={preferredView(exercise.primaryMuscle)}
          height={56}
          showLegend={false}
        />
      </View>

      <View style={styles.body}>
        <Text variant="body" numberOfLines={1}>
          {exercise.name}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {detail ?? `${MUSCLE_GROUP_LABELS[exercise.primaryMuscle]} · ${equipment}`}
        </Text>
      </View>

      {unavailable ? <StatusPill label="Not at your gym" tone="warning" /> : null}

      {prescription ? (
        <Text variant="bodySmall" tone="secondary" mono>
          {prescription}
        </Text>
      ) : null}

      {onSwap ? (
        <Pressable
          onPress={onSwap}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Swap ${exercise.name}`}
          style={({ pressed }) => [styles.swap, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name="arrowFlat" size={16} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  figure: {
    width: 36,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  swap: {
    padding: spacing.xs,
    borderRadius: radius.sm,
  },
});
