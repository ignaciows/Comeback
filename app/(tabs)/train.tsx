import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Button';
import { EmptyState } from '@/components/Feedback';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { exerciseName } from '@/data/exercises';
import { estimateRoutineDayMinutes } from '@/data/routineTemplates';
import { sessionSetCount, sessionVolume } from '@/domain/training/metrics';
import { useActiveRoutine, useActiveSession, useCompletedSessions, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { addDays, formatRelativeDay, today as todayOf } from '@/utils/date';

export default function TrainScreen() {
  const router = useRouter();
  const routine = useActiveRoutine();
  const engine = useEngine();
  const history = useCompletedSessions();
  const activeSession = useActiveSession();
  const startSession = useAppStore((state) => state.startSession);
  const plannedSessions = useAppStore((state) => state.plannedSessions);

  const date = todayOf();
  const next = engine.nextPlanned;
  const nextDay = routine?.days.find((day) => day.id === next?.routineDayId) ?? null;

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
      <Text variant="title" style={styles.title}>
        Train
      </Text>

      {activeSession ? (
        <Section title="In progress">
          <Text variant="heading">{activeSession.name}</Text>
          <PrimaryButton
            label="Resume session"
            onPress={() => router.push({ pathname: '/session', params: { id: activeSession.id } })}
            style={styles.action}
          />
        </Section>
      ) : (
        <Section title="Next session">
          {next && nextDay ? (
            <>
              <Text variant="title">{nextDay.name}</Text>
              <Text variant="bodySmall" tone="secondary" style={styles.subtitle}>
                {`${formatRelativeDay(next.date, date)} · ${nextDay.exercises.length} exercises · about ${estimateRoutineDayMinutes(nextDay)} min`}
              </Text>
              <View style={styles.exercises}>
                {nextDay.exercises.map((exercise) => (
                  <View key={exercise.id} style={styles.exerciseRow}>
                    <Text variant="bodySmall" tone="secondary">
                      {exerciseName(exercise.exerciseId)}
                    </Text>
                    <Text variant="bodySmall" tone="tertiary" mono>
                      {`${exercise.sets} × ${exercise.repMin}–${exercise.repMax}`}
                    </Text>
                  </View>
                ))}
              </View>
              <PrimaryButton
                label={next.date === date ? 'Start session' : `Start ${nextDay.name}`}
                onPress={() => start(nextDay.id, nextDay.name, next.date === date ? next.id : null)}
                style={styles.action}
              />
            </>
          ) : (
            <EmptyState
              title="Nothing scheduled"
              description="Your plan runs three weeks ahead. Set your training days in Profile to schedule more."
              action={{ label: 'Open profile', onPress: () => router.push('/(tabs)/profile') }}
            />
          )}
          <SecondaryButton label="Free workout" onPress={() => start(null, 'Free session', null)} style={styles.action} />
        </Section>
      )}

      {routine ? (
        <Section
          title="Current routine"
          action={{ label: 'Edit', onPress: () => router.push('/routine') }}
          footnote={`${routine.name} · ${routine.daysPerWeek} days per week`}
        >
          {routine.days.map((day, index) => (
            <View key={day.id}>
              {index > 0 ? <Divider /> : null}
              <MetricRow
                label={day.name}
                detail={`${day.exercises.length} exercises`}
                value={`${estimateRoutineDayMinutes(day)}m`}
                onPress={() => start(day.id, day.name, null)}
              />
            </View>
          ))}
        </Section>
      ) : null}

      <Section
        title="This week"
        footnote="Planned days are created three weeks ahead and can be moved without losing credit."
      >
        {plannedSessions
          .filter((entry) => entry.date >= engine.week.start && entry.date <= addDays(engine.week.start, 6))
          .sort((a, b) => (a.date < b.date ? -1 : 1))
          .slice(0, 7)
          .map((entry, index) => {
            const day = routine?.days.find((item) => item.id === entry.routineDayId);
            return (
              <View key={entry.id}>
                {index > 0 ? <Divider /> : null}
                <MetricRow
                  label={formatRelativeDay(entry.date, date)}
                  detail={day?.name ?? 'Rest'}
                  value={entry.status === 'planned' ? '' : entry.status}
                />
              </View>
            );
          })}
      </Section>

      <Section title="Recent sessions" action={history.length > 0 ? { label: 'All', onPress: () => router.push('/history') } : undefined}>
        {history.length === 0 ? (
          <EmptyState
            title="No sessions logged"
            description="Your first session establishes the baseline every later comparison uses."
          />
        ) : (
          history.slice(0, 5).map((session, index) => (
            <View key={session.id}>
              {index > 0 ? <Divider /> : null}
              <MetricRow
                label={session.name}
                detail={`${formatRelativeDay(session.date, date)} · ${sessionSetCount(session)} sets`}
                value={`${Math.round(sessionVolume(session)).toLocaleString()} kg`}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: session.id } })}
              />
            </View>
          ))
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xxl,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  exercises: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  action: {
    marginTop: spacing.lg,
  },
});
