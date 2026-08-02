import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, ConfirmationSheet } from '@/components/BottomSheet';
import { ActionBar, IconButton, PrimaryButton, SecondaryButton, TextButton } from '@/components/Button';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { colors, opacity, spacing } from '@/design-system/tokens';
import { exerciseName, findSubstitutions, getExercise } from '@/data/exercises';
import type { WorkoutExercise } from '@/domain/types';
import { ExercisePicker } from '@/features/training/ExercisePicker';
import { FormGuideSheet } from '@/features/training/FormGuide';
import { formatPreviousSet, previousPerformance } from '@/features/training/history';
import { ExerciseRow } from '@/features/training/ExerciseRow';
import { RestTimer } from '@/features/training/RestTimer';
import { SessionBar } from '@/features/training/SessionBar';
import { SetRow } from '@/features/training/SetRow';
import { WarmupCard } from '@/features/training/WarmupCard';
import { sessionProgress } from '@/domain/training/sessionProgress';
import { useSession } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatDuration, formatShortDate } from '@/utils/date';

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const sessionId = params.id ?? activeSessionId ?? undefined;
  const session = useSession(sessionId);

  const sessions = useAppStore((state) => state.sessions);
  const gyms = useAppStore((state) => state.gyms);
  const gymId = useAppStore((state) => state.training.gymId);
  const defaultRestSeconds = useAppStore((state) => state.preferences.defaultRestSeconds);

  const addSet = useAppStore((state) => state.addSet);
  const updateSet = useAppStore((state) => state.updateSet);
  const removeSet = useAppStore((state) => state.removeSet);
  const addExerciseToSession = useAppStore((state) => state.addExerciseToSession);
  const removeExerciseFromSession = useAppStore((state) => state.removeExerciseFromSession);
  const moveExercise = useAppStore((state) => state.moveExercise);
  const substituteExercise = useAppStore((state) => state.substituteExercise);
  const setSessionNotes = useAppStore((state) => state.setSessionNotes);
  const finishSession = useAppStore((state) => state.finishSession);
  const pauseSession = useAppStore((state) => state.pauseSession);
  const resumeSession = useAppStore((state) => state.resumeSession);
  const restartSession = useAppStore((state) => state.restartSession);
  const toggleExerciseSkipped = useAppStore((state) => state.toggleExerciseSkipped);
  const discardSession = useAppStore((state) => state.discardSession);

  // The screen stays on while a session is open — phones get put down mid-set.
  useKeepAwake();

  const [elapsed, setElapsed] = useState(0);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [restDuration, setRestDuration] = useState(defaultRestSeconds);
  const [substituting, setSubstituting] = useState<WorkoutExercise | null>(null);
  const [guiding, setGuiding] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  useEffect(() => {
    if (!session || session.status !== 'active') return;
    const started = new Date(session.startedAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Recomputed every second with the clock, so the pause timer runs live.
  const progress = useMemo(
    () => (session ? sessionProgress(session) : null),
    // `elapsed` is the tick; the session itself changes far less often.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, elapsed],
  );

  const equipmentAvailability = useMemo(
    () => gyms.find((gym) => gym.id === gymId)?.equipment ?? {},
    [gyms, gymId],
  );

  const completedSets = useMemo(
    () =>
      session?.exercises.reduce(
        (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
        0,
      ) ?? 0,
    [session],
  );

  if (!session) {
    return (
      <Screen>
        <Header title="Session" leading={{ icon: 'close', onPress: () => router.back(), label: 'Close' }} />
        <EmptyState
          title="No session in progress"
          description="Start a session from Today or Train and it will appear here."
          action={{ label: 'Go to Today', onPress: () => router.replace('/(tabs)/today') }}
        />
      </Screen>
    );
  }

  const readOnly = session.status !== 'active';

  const completeSet = (exercise: WorkoutExercise, setId: string) => {
    const set = exercise.sets.find((entry) => entry.id === setId);
    if (!set) return;
    const nextCompleted = !set.completed;

    // Confirming a set with nothing typed uses the suggested values, which is
    // what makes "same as last time" a single tap.
    const patch = nextCompleted
      ? {
          completed: true,
          weightKg: set.weightKg,
          reps: set.reps,
        }
      : { completed: false };

    updateSet(session.id, exercise.id, setId, patch);
    Haptics.impactAsync(
      nextCompleted ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );

    if (nextCompleted && !set.warmup) {
      setRestDuration(defaultRestSeconds);
      setRestStartedAt(Date.now());
    }
  };

  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title={session.name}
        subtitle={
          readOnly
            ? formatShortDate(session.date)
            : `${formatDuration(elapsed)} · ${completedSets} set${completedSets === 1 ? '' : 's'} logged`
        }
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
        trailing={
          session.intent !== 'full' ? (
            <StatusPill
              label={session.intent}
              tone={session.intent === 'recovery' ? 'info' : 'warning'}
            />
          ) : undefined
        }
      />

      {!readOnly && progress ? (
        <SessionBar
          progress={progress}
          usualRestSeconds={defaultRestSeconds}
          onPause={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            pauseSession(session.id);
          }}
          onResume={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            resumeSession(session.id);
          }}
        />
      ) : null}

      {/* Before anything heavy. Built from today's patterns, not a ritual. */}
      {!readOnly && session.exercises.length > 0 ? (
        <WarmupCard session={session} history={sessions} />
      ) : null}

      {/* Same session, one set at a time — for when a movement needs watching. */}
      {!readOnly ? (
        <SecondaryButton
          label="Guided mode"
          icon="play"
          onPress={() => router.replace({ pathname: '/guided', params: { id: session.id } })}
          style={styles.guided}
        />
      ) : null}

      {!readOnly ? (
        <RestTimer
          startedAt={restStartedAt}
          durationSeconds={restDuration}
          onExtend={(seconds) => setRestDuration((current) => current + seconds)}
          onDismiss={() => setRestStartedAt(null)}
        />
      ) : null}

      {session.exercises.length === 0 ? (
        <EmptyState
          title="No exercises yet"
          description="Add the movements you are doing today. Anything you log counts towards your history."
          action={{ label: 'Add exercise', onPress: () => setPicking(true) }}
        />
      ) : null}

      {session.exercises.map((exercise, index) => {
        const previous = previousPerformance(sessions, exercise.exerciseId, session.id);
        const meta = getExercise(exercise.exerciseId);
        return (
          <Section key={exercise.id} style={exercise.skipped ? styles.skipped : undefined}>
            <View style={styles.exerciseHead}>
              <Pressable
                onPress={() => setGuiding(exercise.exerciseId)}
                accessibilityRole="button"
                accessibilityLabel={`How to do ${exerciseName(exercise.exerciseId)}`}
                style={styles.exerciseTitle}
              >
                <View style={styles.exerciseTitleRow}>
                  <Text variant="heading">{exerciseName(exercise.exerciseId)}</Text>
                  <Icon name="info" size={14} color={colors.textTertiary} />
                </View>
                <Text variant="caption" tone="tertiary">
                  {previous
                    ? `Last time ${formatShortDate(previous.date)} · ${previous.sets.length} sets`
                    : 'First time logging this'}
                </Text>
                {exercise.substitutedFrom ? (
                  <Text variant="caption" tone="tertiary">
                    {`Replaced ${exerciseName(exercise.substitutedFrom)}`}
                  </Text>
                ) : null}
              </Pressable>
              {!readOnly ? (
                <View style={styles.exerciseActions}>
                  <IconButton
                    icon={exercise.skipped ? 'plus' : 'minus'}
                    label={exercise.skipped ? 'Put it back' : 'Not doing this one'}
                    size={16}
                    onPress={() => {
                      Haptics.selectionAsync();
                      toggleExerciseSkipped(session.id, exercise.id);
                    }}
                  />
                  <IconButton
                    icon="arrowUp"
                    label="Move up"
                    size={16}
                    onPress={() => moveExercise(session.id, exercise.id, -1)}
                    disabled={index === 0}
                  />
                  <IconButton
                    icon="arrowDown"
                    label="Move down"
                    size={16}
                    onPress={() => moveExercise(session.id, exercise.id, 1)}
                    disabled={index === session.exercises.length - 1}
                  />
                  <IconButton
                    icon="edit"
                    label="Substitute exercise"
                    size={16}
                    onPress={() => setSubstituting(exercise)}
                  />
                  <IconButton
                    icon="trash"
                    label="Remove exercise"
                    size={16}
                    tone="danger"
                    onPress={() => removeExerciseFromSession(session.id, exercise.id)}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.setHeader}>
              <Text variant="caption" tone="tertiary" style={styles.setHeaderIndex}>
                Set
              </Text>
              <Text variant="caption" tone="tertiary" style={styles.setHeaderPrevious}>
                Last
              </Text>
              <Text variant="caption" tone="tertiary" style={styles.setHeaderField}>
                kg
              </Text>
              <Text variant="caption" tone="tertiary" style={styles.setHeaderField}>
                Reps
              </Text>
              <Text variant="caption" tone="tertiary" style={styles.setHeaderField}>
                RIR
              </Text>
              <View style={styles.setHeaderSpacer} />
            </View>

            {exercise.sets.map((set, setIndex) => (
              <SetRow
                key={set.id}
                set={set}
                index={setIndex}
                editable={!readOnly}
                previous={formatPreviousSet(previous?.sets[setIndex])}
                onChange={(patch) => updateSet(session.id, exercise.id, set.id, patch)}
                onComplete={() => completeSet(exercise, set.id)}
                onRemove={() => removeSet(session.id, exercise.id, set.id)}
              />
            ))}

            {!readOnly ? (
              <View style={styles.setActions}>
                <TextButton label="Add set" onPress={() => addSet(session.id, exercise.id)} />
                <TextButton
                  label="Repeat last"
                  onPress={() => addSet(session.id, exercise.id, { duplicateLast: true })}
                />
                <TextButton
                  label="Warm-up"
                  onPress={() => addSet(session.id, exercise.id, { warmup: true })}
                />
              </View>
            ) : null}

            {meta ? (
              <Text variant="caption" tone="tertiary" style={styles.meta}>
                {`${meta.primaryMuscle} · rest ${Math.round(defaultRestSeconds / 60)} min`}
              </Text>
            ) : null}
          </Section>
        );
      })}

      {!readOnly ? (
        <>
          <Section>
            <SecondaryButton label="Add exercise" icon="plus" onPress={() => setPicking(true)} />
          </Section>

          <Section title="Notes">
            <Input
              value={session.notes ?? ''}
              onChangeText={(value) => setSessionNotes(session.id, value)}
              placeholder="Anything worth remembering next time"
              multiline
            />
          </Section>

          <ActionBar>
            <PrimaryButton
              label="Finish session"
              onPress={() => setConfirmFinish(true)}
              disabled={completedSets === 0}
            />
            {completedSets === 0 ? (
              <Note>Complete at least one set before finishing, or discard the session.</Note>
            ) : null}
            <TextButton label="Start this session over" onPress={() => setConfirmRestart(true)} style={styles.discard} />
            <TextButton label="Discard session" onPress={() => setConfirmDiscard(true)} style={styles.discard} />
          </ActionBar>
        </>
      ) : null}

      <BottomSheet
        visible={substituting !== null}
        onClose={() => setSubstituting(null)}
        title="Substitute exercise"
        subtitle={
          substituting
            ? `Alternatives for ${exerciseName(substituting.exerciseId)}, ordered by what your gym has.`
            : undefined
        }
      >
        {(substituting ? findSubstitutions(substituting.exerciseId, equipmentAvailability) : []).map((option) => (
          <Pressable
            key={option.exercise.id}
            onPress={() => {
              if (!substituting) return;
              substituteExercise(session.id, substituting.id, option.exercise.id);
              setSubstituting(null);
            }}
            style={({ pressed }) => [pressed && { opacity: opacity.pressed }]}
          >
            <ExerciseRow
              exercise={option.exercise}
              detail={option.reason}
              unavailable={!option.availableHere}
            />
          </Pressable>
        ))}
      </BottomSheet>

      <ExercisePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={(exerciseId) => addExerciseToSession(session.id, exerciseId)}
      />

      <FormGuideSheet exerciseId={guiding} onClose={() => setGuiding(null)} />

      <ConfirmationSheet
        visible={confirmFinish}
        onClose={() => setConfirmFinish(false)}
        title="Finish session"
        message={`${completedSets} sets will be saved. Sets you did not complete are discarded, not recorded as zeroes.`}
        confirmLabel="Finish"
        onConfirm={() => {
          finishSession(session.id);
          router.replace({ pathname: '/workout/[id]', params: { id: session.id } });
        }}
      />

      <ConfirmationSheet
        visible={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        title="Start over"
        message="Every set is unticked and the clock restarts. The exercises stay as they are, so nothing has to be set up again."
        confirmLabel="Start over"
        onConfirm={() => {
          restartSession(session.id);
          setConfirmRestart(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />

      <ConfirmationSheet
        visible={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard session"
        message="Nothing from this session will be saved and it will not count towards adherence."
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          discardSession(session.id);
          router.replace('/(tabs)/today');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  exerciseHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  exerciseTitle: {
    flex: 1,
    gap: 2,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  setHeaderIndex: {
    width: 22,
    textAlign: 'center',
  },
  setHeaderPrevious: {
    width: 62,
  },
  setHeaderField: {
    flex: 1,
    minWidth: 44,
    textAlign: 'center',
  },
  setHeaderSpacer: {
    width: 34 + 16,
  },
  setActions: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.sm,
  },
  meta: {
    marginTop: spacing.sm,
  },
  skipped: {
    opacity: opacity.disabled,
  },
  discard: {
    alignSelf: 'center',
  },
  guided: {
    marginBottom: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  pickerList: {
    marginTop: spacing.md,
  },
});
