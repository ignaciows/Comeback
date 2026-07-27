import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { StatusPill } from '@/components/Feedback';
import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { estimateRoutineDayMinutes } from '@/data/routineTemplates';
import { useActiveRoutine, useActiveSession, useCompletedSessions, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatRelativeDay, today as todayOf } from '@/utils/date';

/** One card with the next session, then rows to everything else. */
export default function TrainScreen() {
  const router = useRouter();
  const routine = useActiveRoutine();
  const engine = useEngine();
  const history = useCompletedSessions();
  const activeSession = useActiveSession();
  const startSession = useAppStore((state) => state.startSession);

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
      <Reveal index={0}>
        <Text variant="title" style={styles.title}>
          Train
        </Text>
      </Reveal>

      <Reveal index={1}>
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
                Set your training days in Profile, or train freely today.
              </Text>
              <PrimaryButton
                label="Free workout"
                onPress={() => start(null, 'Free session', null)}
                style={styles.cta}
              />
            </>
          )}
          {!activeSession && nextDay ? (
            <TextButton
              label="Something else today"
              onPress={() => start(null, 'Free session', null)}
              style={styles.alt}
            />
          ) : null}
        </View>
      </Reveal>

      <Reveal index={2}>
        <NavGroup style={styles.group}>
          <NavRow
            label="Routine"
            value={routine ? `${routine.daysPerWeek} days` : '—'}
            detail={routine?.name}
            onPress={() => router.push('/routine')}
          />
          <NavRow
            label="This week"
            value={`${engine.week.completed} of ${engine.week.target}`}
            onPress={() => router.push('/consistency')}
          />
          <NavRow
            label="History"
            value={`${history.length}`}
            detail={history.length === 0 ? 'Nothing logged yet' : undefined}
            onPress={() => router.push('/history')}
          />
          <NavRow label="Exercises" onPress={() => router.push('/exercises')} />
        </NavGroup>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xl,
  },
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
