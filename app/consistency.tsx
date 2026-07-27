import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActivityGrid } from '@/components/Chart';
import { Header } from '@/components/Header';
import { Metric, MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { DayStrip } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { useCompletedSessions, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { daysBetween, formatRelativeDay, lastNDays, today as todayOf, weekdayLabel } from '@/utils/date';
import { round } from '@/utils/math';

const WINDOW_DAYS = 28;

/** Attendance: this week, the last four weeks, and what is scheduled next. */
export default function ConsistencyScreen() {
  const router = useRouter();
  const engine = useEngine();
  const sessions = useCompletedSessions();
  const plannedSessions = useAppStore((state) => state.plannedSessions);
  const routines = useAppStore((state) => state.routines);

  const date = todayOf();
  const windowDates = useMemo(() => lastNDays(date, WINDOW_DAYS), [date]);

  const recent = useMemo(
    () => sessions.filter((session) => daysBetween(session.date, date) < WINDOW_DAYS),
    [sessions, date],
  );

  const activity = useMemo(() => {
    const trained = new Set(sessions.map((session) => session.date));
    const missed = new Set(
      plannedSessions
        .filter((entry) => entry.status === 'skipped' || (entry.status === 'planned' && entry.date < date))
        .map((entry) => entry.date),
    );
    return windowDates.map((day) => ({ date: day, active: trained.has(day), missed: missed.has(day) }));
  }, [sessions, plannedSessions, windowDates, date]);

  const upcoming = useMemo(
    () =>
      plannedSessions
        .filter((entry) => entry.date >= date && entry.status === 'planned')
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .slice(0, 5),
    [plannedSessions, date],
  );

  const dayName = (routineDayId: string | null) => {
    for (const routine of routines) {
      const day = routine.days.find((entry) => entry.id === routineDayId);
      if (day) return day.name;
    }
    return 'Session';
  };

  return (
    <Screen>
      <Header
        title="Consistency"
        subtitle={`${engine.week.completed} of ${engine.week.target} this week`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <Section title="This week">
          <DayStrip days={engine.week.days.map((day) => ({ key: day.date, state: day.state }))} />
          <View style={styles.weekLabels}>
            {engine.week.days.map((day) => (
              <Text key={day.date} variant="caption" tone="tertiary" style={styles.weekLabel}>
                {weekdayLabel(new Date(`${day.date}T00:00:00`).getDay()).slice(0, 1)}
              </Text>
            ))}
          </View>
        </Section>
      </Reveal>

      <Reveal index={1}>
        <Section title={`Last ${WINDOW_DAYS} days`}>
          <View style={styles.metrics}>
            <Metric label="Sessions" value={`${recent.length}`} />
            <Metric
              label="Per week"
              value={`${round(recent.length / (WINDOW_DAYS / 7), 1)}`}
              size="small"
              caption={`Target ${engine.week.target}`}
            />
          </View>
          <View style={styles.grid}>
            <ActivityGrid days={activity} />
          </View>
        </Section>
      </Reveal>

      <Reveal index={2}>
        <Section title="Coming up">
          {upcoming.length === 0 ? (
            <Text variant="bodySmall" tone="tertiary">
              Nothing scheduled.
            </Text>
          ) : (
            upcoming.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 ? <Divider /> : null}
                <MetricRow label={dayName(entry.routineDayId)} value={formatRelativeDay(entry.date, date)} />
              </View>
            ))
          )}
        </Section>
      </Reveal>

      <Reveal index={3}>
        <Section>
          <MetricRow label="All sessions" onPress={() => router.push('/history')} chevron />
        </Section>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  weekLabels: {
    flexDirection: 'row',
    gap: 4,
    marginTop: spacing.sm,
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
  },
  metrics: {
    flexDirection: 'row',
    gap: spacing.xxl,
  },
  grid: {
    marginTop: spacing.xl,
  },
});
