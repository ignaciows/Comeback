import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { PrimaryButton, TextButton } from '@/components/Button';
import { StatusPill } from '@/components/Feedback';
import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { exerciseName, findSubstitutions, getExercise } from '@/data/exercises';
import { estimateRoutineDayMinutes } from '@/data/routineTemplates';
import { ExerciseRow } from '@/features/training/ExerciseRow';
import { useActiveRoutine, useActiveSession, useCompletedSessions, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatRelativeDay, today as todayOf } from '@/utils/date';

/**
 * The next session, laid out.
 *
 * What you are doing, in order, with the muscle each movement works drawn next
 * to it and a one-tap swap when the gym does not have the kit or you would
 * rather do something else. Nothing on this screen needs reading twice.
 */
export default function TrainScreen() {
  const router = useRouter();
  const routine = useActiveRoutine();
  const engine = useEngine();
  const history = useCompletedSessions();
  const activeSession = useActiveSession();
  const startSession = useAppStore((state) => state.startSession);
  const updateRoutineExercise = useAppStore((state) => state.updateRoutineExercise);
  const gyms = useAppStore((state) => state.gyms);
  const gymId = useAppStore((state) => state.training.gymId);

  const [swapping, setSwapping] = useState<{ dayId: string; entryId: string; exerciseId: string } | null>(null);

  const date = todayOf();
  const next = engine.nextPlanned;
  const nextDay = routine?.days.find((day) => day.id === next?.routineDayId) ?? null;
  const gym = gyms.find((entry) => entry.id === gymId) ?? gyms[0] ?? null;
  const equipment = gym?.equipment ?? {};

  const start = (routineDayId: string | null, name: string, plannedSessionId: string | null) => {
    const id = startSession({
      routineId: routine?.id ?? null,
      routineDayId,
      intent: routineDayId ? 'full' : 'free',
      name,
      plannedSessionId,
    });
    router.push({ pathname: '/session', params: { id } });
  };

  return (
    <Screen>
      <Reveal index={0}>
        <View style={styles.hero}>
          {activeSession ? (
            <>
              <StatusPill label="In progress" tone="info" />
              <Text variant="display" style={styles.heroTitle}>
                {activeSession.name}
              </Text>
              <PrimaryButton
                label="Resume"
                onPress={() => router.push({ pathname: '/session', params: { id: activeSession.id } })}
                style={styles.cta}
              />
            </>
          ) : nextDay && next ? (
            <>
              <StatusPill label={formatRelativeDay(next.date, date)} tone={next.date === date ? 'accent' : 'neutral'} />
              <Text variant="display" style={styles.heroTitle}>
                {nextDay.name}
              </Text>
              <Text variant="body" tone="secondary" style={styles.heroLine}>
                {`${nextDay.exercises.length} exercises · about ${estimateRoutineDayMinutes(nextDay)} minutes`}
              </Text>
              <PrimaryButton
                label="Start"
                onPress={() => start(nextDay.id, nextDay.name, next.date === date ? next.id : null)}
                style={styles.cta}
              />
            </>
          ) : (
            <>
              <Text variant="display" style={styles.heroTitle}>
                Nothing scheduled
              </Text>
              <Text variant="body" tone="secondary" style={styles.heroLine}>
                Train freely today, or set your days in the plan.
              </Text>
              <PrimaryButton label="Free workout" onPress={() => start(null, 'Free session', null)} style={styles.cta} />
            </>
          )}
          {!activeSession && nextDay ? (
            <TextButton label="Something else today" onPress={() => start(null, 'Free session', null)} style={styles.alt} />
          ) : null}
        </View>
      </Reveal>

      {/* The actual work, in order. */}
      {nextDay && !activeSession ? (
        <Reveal index={1}>
          <Section title="What you are doing">
            {nextDay.exercises.map((entry) => {
              const exercise = getExercise(entry.exerciseId);
              if (!exercise) return null;
              const missing = exercise.equipment.some((item) => equipment[item] === 'unavailable');

              return (
                <ExerciseRow
                  key={entry.id}
                  exercise={exercise}
                  prescription={`${entry.sets} × ${entry.repMin}–${entry.repMax}`}
                  unavailable={missing}
                  onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
                  onSwap={() => setSwapping({ dayId: nextDay.id, entryId: entry.id, exerciseId: exercise.id })}
                />
              );
            })}
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={2}>
        <NavGroup style={styles.group}>
          {/* Which gym you are in decides which exercises are even possible,
              so it belongs here rather than buried in settings. */}
          <NavRow
            label="Your gym"
            icon="gym"
            value={gym ? gym.name.split(' · ')[0] : 'Find one'}
            detail={gym ? undefined : 'So the plan knows what you can use'}
            tone={gym ? 'neutral' : 'accent'}
            dot={!gym}
            onPress={() => router.push(gym ? '/gym' : '/gyms')}
          />
          <NavRow
            label="Routine"
            icon="train"
            value={routine ? `${routine.daysPerWeek} days` : '—'}
            onPress={() => router.push('/routine')}
          />
          <NavRow
            label="This week"
            icon="calendar"
            value={`${engine.week.completed} of ${engine.week.target}`}
            onPress={() => router.push('/consistency')}
          />
          <NavRow
            label="History"
            icon="journal"
            value={`${history.length}`}
            onPress={() => router.push('/history')}
          />
          <NavRow label="Exercises" icon="search" onPress={() => router.push('/exercises')} />
        </NavGroup>
      </Reveal>

      <BottomSheet
        visible={swapping !== null}
        onClose={() => setSwapping(null)}
        title="Swap exercise"
        subtitle={swapping ? `Instead of ${exerciseName(swapping.exerciseId)} — what your gym has comes first.` : undefined}
      >
        {(swapping ? findSubstitutions(swapping.exerciseId, equipment) : []).slice(0, 8).map((option) => (
          <Pressable
            key={option.exercise.id}
            onPress={() => {
              if (!swapping) return;
              updateRoutineExercise(swapping.dayId, swapping.entryId, { exerciseId: option.exercise.id });
              setSwapping(null);
            }}
            style={({ pressed }) => [pressed && { opacity: opacity.pressed }]}
          >
            <ExerciseRow exercise={option.exercise} detail={option.reason} unavailable={!option.availableHere} />
          </Pressable>
        ))}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  heroTitle: {
    marginTop: spacing.xl,
    fontSize: 40,
    lineHeight: 44,
  },
  heroLine: {
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.xl,
  },
  alt: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  group: {
    marginTop: spacing.xl,
  },
});
