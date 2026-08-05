import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/design-system/tokens';
import { getExercise } from '@/data/exercises';
import type { EquipmentId, MovementPattern } from '@/domain/types';
import { ExerciseStages } from '@/features/training/ExerciseStages';
import { MOVEMENT_ART } from '@/features/training/movementArt';

/**
 * What a movement looks like: the render when there is one, the diagram when
 * there is not.
 *
 * The two-frame SVG diagram is better at one job — it shows the start and the
 * end of the rep, which a single still cannot. The render is better at the
 * other — it shows the setup, which limb is where and what the machine looks
 * like, and it is the thing that makes the app feel built rather than
 * sketched.
 *
 * So this is not a replacement. Exercises with a render get it; the rest keep
 * the diagram, and nothing has to be rendered before the app works. That is
 * deliberate: a visual system that only functions once all fifty-one assets
 * exist is one that is broken for as long as it takes to draw them.
 */
export function MovementArt({
  exerciseId,
  pattern,
  equipment = [],
  style,
}: {
  exerciseId?: string;
  pattern: MovementPattern;
  equipment?: EquipmentId[];
  style?: ViewStyle;
}) {
  const art = exerciseId ? MOVEMENT_ART[exerciseId] : undefined;

  if (!art) {
    return <ExerciseStages pattern={pattern} equipment={equipment} style={style} />;
  }

  const meta = exerciseId ? getExercise(exerciseId) : null;

  return (
    <View style={[styles.frame, style]}>
      <Image
        source={art}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel={meta ? `${meta.name}, wireframe illustration` : 'Movement illustration'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
    marginVertical: spacing.sm,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
