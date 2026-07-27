import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarRow } from '@/components/Chart';
import { EmptyState } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Metric, MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS, exerciseName, getExercise } from '@/data/exercises';
import {
  bestE1rmByExercise,
  sessionVolume,
  volumeByExercise,
  volumeByMuscleGroup,
} from '@/domain/training/metrics';
import type { MuscleGroup } from '@/domain/types';
import { useCompletedSessions } from '@/store/hooks';
import { daysBetween, today as todayOf } from '@/utils/date';

const WINDOW_DAYS = 28;

/** What the training is actually doing: volume, distribution, best lifts. */
export default function PerformanceScreen() {
  const router = useRouter();
  const sessions = useCompletedSessions();
  const date = todayOf();

  const recent = useMemo(
    () => sessions.filter((session) => daysBetween(session.date, date) < WINDOW_DAYS),
    [sessions, date],
  );

  const muscleVolume = useMemo(
    () =>
      volumeByMuscleGroup(recent, (id) => {
        const exercise = getExercise(id);
        return exercise
          ? { primaryMuscle: exercise.primaryMuscle, secondaryMuscles: exercise.secondaryMuscles }
          : undefined;
      }),
    [recent],
  );

  const exerciseVolume = useMemo(() => volumeByExercise(recent), [recent]);
  const bests = useMemo(() => bestE1rmByExercise(sessions), [sessions]);

  const totalVolume = useMemo(
    () => recent.reduce((total, session) => total + sessionVolume(session), 0),
    [recent],
  );

  const top = useMemo(
    () => Object.entries(exerciseVolume).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [exerciseVolume],
  );

  const maxMuscle = Math.max(1, ...Object.values(muscleVolume).map((value) => value ?? 0));

  return (
    <Screen>
      <Header
        title="Performance"
        subtitle={`Last ${WINDOW_DAYS} days`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {recent.length === 0 ? (
        <EmptyState
          title="No sessions in this window"
          description="Volume and lift history appear once you log a session."
        />
      ) : (
        <>
          <Reveal index={0}>
            <Section>
              <View style={styles.metrics}>
                <Metric label="Volume" value={Math.round(totalVolume).toLocaleString()} unit="kg" />
                <Metric label="Sessions" value={`${recent.length}`} size="small" intent="neutral" />
              </View>
            </Section>
          </Reveal>

          <Reveal index={1}>
            <Section title="By muscle group" footnote="Secondary muscles count at half.">
              {(Object.keys(muscleVolume) as MuscleGroup[])
                .sort((a, b) => (muscleVolume[b] ?? 0) - (muscleVolume[a] ?? 0))
                .map((muscle) => (
                  <BarRow
                    key={muscle}
                    label={MUSCLE_GROUP_LABELS[muscle]}
                    value={muscleVolume[muscle] ?? 0}
                    max={maxMuscle}
                    valueLabel={`${Math.round(muscleVolume[muscle] ?? 0).toLocaleString()} kg`}
                  />
                ))}
            </Section>
          </Reveal>

          <Reveal index={2}>
            <Section title="Top exercises" footnote="Estimated 1RM from your best working set — an estimate, not a test.">
              {top.map(([exerciseId, volume], index) => (
                <View key={exerciseId}>
                  {index > 0 ? <Divider /> : null}
                  <MetricRow
                    label={exerciseName(exerciseId)}
                    detail={`${Math.round(volume).toLocaleString()} kg`}
                    value={bests[exerciseId] ? `${bests[exerciseId]} kg` : '—'}
                    onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } })}
                  />
                </View>
              ))}
            </Section>
          </Reveal>
        </>
      )}

      <Section>
        <MetricRow label="All exercises" onPress={() => router.push('/exercises')} chevron />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.xxl,
  },
});
