import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Note } from '@/components/Feedback';
import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS, exerciseName, getExercise } from '@/data/exercises';
import { guidanceFor } from '@/data/exerciseGuidance';
import { EquipmentIllustration, equipmentHint } from './EquipmentIllustration';
import { MovementArt } from './MovementArt';
import { MuscleMap } from './MuscleMap';

/** Numbered or bulleted lines under a small heading. */
function Block({ title, items, numbered = false }: { title: string; items: string[]; numbered?: boolean }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <Label style={styles.blockLabel}>{title}</Label>
      {items.map((item, index) => (
        <View key={item} style={styles.line}>
          <Text variant="caption" tone="tertiary" mono style={styles.marker}>
            {numbered ? `${index + 1}` : '·'}
          </Text>
          <Text variant="bodySmall" tone="secondary" style={styles.lineText}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** The technique for one exercise, laid out to be read between sets. */
export function FormGuideContent({ exerciseId }: { exerciseId: string }) {
  const exercise = getExercise(exerciseId);
  if (!exercise) return null;
  const guidance = guidanceFor(exerciseId, exercise.pattern);

  return (
    <View>
      {/* What it looks like, then what it works, then how to do it. */}
      <MovementArt
        exerciseId={exercise.id}
        pattern={exercise.pattern}
        equipment={exercise.equipment}
        style={styles.animation}
      />

      <MuscleMap
        primary={exercise.primaryMuscle}
        secondary={exercise.secondaryMuscles}
        height={150}
        style={styles.map}
      />

      <View style={styles.kit}>
        <EquipmentIllustration equipment={exercise.equipment} size={40} />
      </View>
      {equipmentHint(exercise.equipment) ? (
        <Text variant="caption" tone="tertiary" style={styles.hint}>
          {equipmentHint(exercise.equipment)}
        </Text>
      ) : null}

      <Block title="Set up" items={guidance.setup} />
      <Block title="Execution" items={guidance.execution} numbered />
      <Block title="Cues" items={guidance.cues} />
      <Block title="Common mistakes" items={guidance.mistakes} />
      {guidance.tempo ? (
        <View style={styles.block}>
          <Label style={styles.blockLabel}>Tempo</Label>
          <Text variant="bodySmall" tone="secondary">
            {guidance.tempo === 'hold' || guidance.tempo === 'steady'
              ? guidance.tempo === 'hold'
                ? 'Hold the position; quality over duration.'
                : 'Steady, sustainable pace throughout.'
              : `${guidance.tempo} — seconds down, pause, seconds up.`}
          </Text>
        </View>
      ) : null}
      <Note style={styles.note}>
        Technique guidance, not medical advice. Stop and reassess if a movement hurts.
      </Note>
    </View>
  );
}

export function FormGuideSheet({
  exerciseId,
  onClose,
}: {
  exerciseId: string | null;
  onClose: () => void;
}) {
  const exercise = exerciseId ? getExercise(exerciseId) : null;
  return (
    <BottomSheet
      visible={exerciseId !== null}
      onClose={onClose}
      title={exerciseId ? exerciseName(exerciseId) : ''}
      subtitle={exercise ? `${exercise.primaryMuscle} · ${exercise.isCompound ? 'compound' : 'isolation'}` : undefined}
    >
      {exerciseId ? <FormGuideContent exerciseId={exerciseId} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  animation: {
    marginBottom: spacing.xl,
  },
  kit: {
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  hint: {
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  map: {
    marginBottom: spacing.xl,
  },
  block: {
    marginBottom: spacing.xl,
  },
  blockLabel: {
    marginBottom: spacing.sm,
  },
  line: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  marker: {
    width: 12,
    color: colors.textTertiary,
  },
  lineText: {
    flex: 1,
  },
  note: {
    marginBottom: spacing.md,
  },
});
