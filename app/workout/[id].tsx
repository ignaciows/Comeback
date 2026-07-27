import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmationSheet } from '@/components/BottomSheet';
import { ActionBar, SecondaryButton, TextButton } from '@/components/Button';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Metric } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { exerciseName } from '@/data/exercises';
import {
  estimateOneRepMax,
  sessionDurationMinutes,
  sessionSetCount,
  sessionVolume,
} from '@/domain/training/metrics';
import { formatPreviousSet, previousPerformance } from '@/features/training/history';
import { SetRow } from '@/features/training/SetRow';
import { useSession } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatShortDate } from '@/utils/date';

/** Completed session: review and correct. Records stay editable after the fact. */
export default function WorkoutDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSession(id);
  const sessions = useAppStore((state) => state.sessions);
  const updateSet = useAppStore((state) => state.updateSet);
  const removeSet = useAppStore((state) => state.removeSet);
  const addSet = useAppStore((state) => state.addSet);
  const setSessionNotes = useAppStore((state) => state.setSessionNotes);
  const deleteSession = useAppStore((state) => state.deleteSession);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!session) {
    return (
      <Screen>
        <Header title="Session" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState title="Session not found" description="It may have been deleted." />
      </Screen>
    );
  }

  const bestSets = session.exercises.map((exercise) => {
    const best = exercise.sets
      .filter((set) => !set.warmup)
      .map((set) => ({ set, e1rm: estimateOneRepMax(set) }))
      .sort((a, b) => (b.e1rm ?? 0) - (a.e1rm ?? 0))[0];
    return { exerciseId: exercise.exerciseId, e1rm: best?.e1rm ?? null };
  });

  return (
    <Screen>
      <Header
        title={session.name}
        subtitle={formatShortDate(session.date)}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
        trailing={session.intent !== 'full' ? <StatusPill label={session.intent} tone="warning" /> : undefined}
      />

      <Section>
        <View style={styles.metrics}>
          <Metric label="Volume" value={Math.round(sessionVolume(session)).toLocaleString()} unit="kg" />
          <Metric label="Sets" value={`${sessionSetCount(session)}`} size="small" intent="neutral" />
          <Metric
            label="Duration"
            value={sessionDurationMinutes(session) === null ? '—' : `${sessionDurationMinutes(session)}`}
            unit="min"
            size="small"
            intent="neutral"
          />
        </View>
      </Section>

      {session.exercises.map((exercise) => {
        const previous = previousPerformance(sessions, exercise.exerciseId, session.id);
        const best = bestSets.find((entry) => entry.exerciseId === exercise.exerciseId);
        return (
          <Section key={exercise.id}>
            <View style={styles.exerciseHead}>
              <Text variant="heading">{exerciseName(exercise.exerciseId)}</Text>
              <Text variant="caption" tone="tertiary" mono>
                {best?.e1rm ? `${best.e1rm} kg e1RM` : ''}
              </Text>
            </View>
            {exercise.substitutedFrom ? (
              <Text variant="caption" tone="tertiary" style={styles.substituted}>
                {`Replaced ${exerciseName(exercise.substitutedFrom)}`}
              </Text>
            ) : null}
            {exercise.sets.map((set, index) => (
              <SetRow
                key={set.id}
                set={set}
                index={index}
                editable={editing}
                previous={formatPreviousSet(previous?.sets[index])}
                onChange={(patch) => updateSet(session.id, exercise.id, set.id, patch)}
                onComplete={() => updateSet(session.id, exercise.id, set.id, { completed: !set.completed })}
                onRemove={() => removeSet(session.id, exercise.id, set.id)}
              />
            ))}
            {editing ? (
              <TextButton label="Add set" onPress={() => addSet(session.id, exercise.id, { duplicateLast: true })} />
            ) : null}
          </Section>
        );
      })}

      <Section title="Notes">
        {editing ? (
          <Input
            value={session.notes ?? ''}
            onChangeText={(value) => setSessionNotes(session.id, value)}
            placeholder="Anything worth remembering"
            multiline
          />
        ) : (
          <Text variant="bodySmall" tone={session.notes ? 'secondary' : 'tertiary'}>
            {session.notes || 'No notes'}
          </Text>
        )}
      </Section>

      <Note>
        Corrections are allowed after the fact. Momentum, volume and Comeback Progress are recalculated from the
        corrected data — nothing is frozen.
      </Note>

      <ActionBar>
        <SecondaryButton
          label={editing ? 'Done editing' : 'Correct this session'}
          icon={editing ? 'check' : 'edit'}
          onPress={() => setEditing(!editing)}
        />
        <TextButton label="Delete session" onPress={() => setConfirmDelete(true)} style={styles.delete} />
      </ActionBar>

      <ConfirmationSheet
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete session"
        message="The session is removed and its planned day goes back to open. Momentum recalculates without it."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          deleteSession(session.id);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  substituted: {
    marginBottom: spacing.sm,
  },
  delete: {
    alignSelf: 'center',
  },
});
