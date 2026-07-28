import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { IconButton, SecondaryButton } from '@/components/Button';
import { EmptyState, Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { colors, opacity, spacing } from '@/design-system/tokens';
import { EXERCISES, exerciseName, findSubstitutions, searchExercises } from '@/data/exercises';
import { estimateRoutineDayMinutes } from '@/data/routineTemplates';
import { useActiveRoutine } from '@/store/hooks';
import { ExerciseRow } from '@/features/training/ExerciseRow';
import { useAppStore } from '@/store/useAppStore';

type Target = { dayId: string; exerciseId: string; routineExerciseId: string } | null;

/** View and adjust the routine: sets, rep range, order, substitutions. */
export default function RoutineScreen() {
  const router = useRouter();
  const routine = useActiveRoutine();
  const gyms = useAppStore((state) => state.gyms);
  const gymId = useAppStore((state) => state.training.gymId);

  const updateRoutineExercise = useAppStore((state) => state.updateRoutineExercise);
  const addRoutineExercise = useAppStore((state) => state.addRoutineExercise);
  const removeRoutineExercise = useAppStore((state) => state.removeRoutineExercise);
  const moveRoutineExercise = useAppStore((state) => state.moveRoutineExercise);

  const [substituting, setSubstituting] = useState<Target>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const equipment = gyms.find((gym) => gym.id === gymId)?.equipment ?? {};

  if (!routine) {
    return (
      <Screen>
        <Header title="Routine" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState title="No routine yet" description="Finish onboarding to generate your first routine." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={routine.name}
        subtitle={`${routine.daysPerWeek} days per week`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {routine.days.map((day) => (
        <Section key={day.id} title={day.name} footnote={`About ${estimateRoutineDayMinutes(day)} minutes`}>
          {day.exercises.map((exercise, index) => (
            <View key={exercise.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text variant="body">{exerciseName(exercise.exerciseId)}</Text>
                <View style={styles.controls}>
                  <Stepper
                    label="sets"
                    value={exercise.sets}
                    onChange={(value) => updateRoutineExercise(day.id, exercise.id, { sets: value })}
                    min={1}
                    max={8}
                  />
                  <Stepper
                    label="min reps"
                    value={exercise.repMin}
                    onChange={(value) =>
                      updateRoutineExercise(day.id, exercise.id, {
                        repMin: value,
                        repMax: Math.max(value, exercise.repMax),
                      })
                    }
                    min={1}
                    max={30}
                  />
                  <Stepper
                    label="max reps"
                    value={exercise.repMax}
                    onChange={(value) =>
                      updateRoutineExercise(day.id, exercise.id, {
                        repMax: value,
                        repMin: Math.min(value, exercise.repMin),
                      })
                    }
                    min={1}
                    max={30}
                  />
                </View>
              </View>
              <View style={styles.actions}>
                <IconButton
                  icon="arrowUp"
                  label="Move up"
                  size={16}
                  disabled={index === 0}
                  onPress={() => moveRoutineExercise(day.id, exercise.id, -1)}
                />
                <IconButton
                  icon="arrowDown"
                  label="Move down"
                  size={16}
                  disabled={index === day.exercises.length - 1}
                  onPress={() => moveRoutineExercise(day.id, exercise.id, 1)}
                />
                <IconButton
                  icon="edit"
                  label="Replace exercise"
                  size={16}
                  onPress={() =>
                    setSubstituting({
                      dayId: day.id,
                      exerciseId: exercise.exerciseId,
                      routineExerciseId: exercise.id,
                    })
                  }
                />
                <IconButton
                  icon="trash"
                  label="Remove exercise"
                  size={16}
                  tone="danger"
                  onPress={() => removeRoutineExercise(day.id, exercise.id)}
                />
              </View>
            </View>
          ))}
          <SecondaryButton label="Add exercise" icon="plus" onPress={() => setAdding(day.id)} style={styles.add} />
        </Section>
      ))}

      <Note>
        Changes apply to future sessions. Sessions you already logged keep exactly what you recorded.
      </Note>

      <BottomSheet
        visible={substituting !== null}
        onClose={() => setSubstituting(null)}
        title="Replace exercise"
        subtitle={substituting ? `Alternatives for ${exerciseName(substituting.exerciseId)}` : undefined}
      >
        {(substituting ? findSubstitutions(substituting.exerciseId, equipment) : []).map((option) => (
          <Pressable
            key={option.exercise.id}
            onPress={() => {
              if (!substituting) return;
              updateRoutineExercise(substituting.dayId, substituting.routineExerciseId, {
                exerciseId: option.exercise.id,
              });
              setSubstituting(null);
            }}
            style={({ pressed }) => [pressed && { opacity: opacity.pressed }]}
          >
            <ExerciseRow exercise={option.exercise} detail={option.reason} unavailable={!option.availableHere} />
          </Pressable>
        ))}
      </BottomSheet>

      <BottomSheet
        visible={adding !== null}
        onClose={() => {
          setAdding(null);
          setQuery('');
        }}
        title="Add exercise"
      >
        <Input value={query} onChangeText={setQuery} placeholder="Search" autoCorrect={false} />
        {(query ? searchExercises(query) : EXERCISES).slice(0, 40).map((exercise) => (
          <Pressable
            key={exercise.id}
            onPress={() => {
              if (adding) addRoutineExercise(adding, exercise.id);
              setAdding(null);
              setQuery('');
            }}
            style={({ pressed }) => [styles.option, pressed && { opacity: opacity.pressed }]}
          >
            <Text variant="body">{exercise.name}</Text>
            <Text variant="caption" tone="tertiary">
              {exercise.primaryMuscle}
            </Text>
          </Pressable>
        ))}
      </BottomSheet>
    </Screen>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <View style={styles.stepper}>
      <IconButton
        icon="minus"
        label={`Decrease ${label}`}
        size={13}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - 1))}
      />
      <Text variant="caption" tone="secondary" mono>
        {`${value} ${label}`}
      </Text>
      <IconButton
        icon="plus"
        label={`Increase ${label}`}
        size={13}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + 1))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: {
    flex: 1,
    gap: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  add: {
    marginTop: spacing.lg,
  },
  option: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
