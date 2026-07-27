import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/Chart';
import { EmptyState, Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Metric, MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS, PATTERN_LABELS, exerciseName, getExercise } from '@/data/exercises';
import { estimateOneRepMax, setVolume } from '@/domain/training/metrics';
import { useCompletedSessions } from '@/store/hooks';
import { formatShortDate } from '@/utils/date';

/** Per-exercise history: estimated 1RM trend, volume and every logged session. */
export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessions = useCompletedSessions();
  const meta = getExercise(id);

  const entries = useMemo(
    () =>
      [...sessions]
        .reverse()
        .map((session) => {
          const exercise = session.exercises.find((entry) => entry.exerciseId === id);
          if (!exercise) return null;
          const sets = exercise.sets.filter((set) => set.completed && !set.warmup);
          if (sets.length === 0) return null;
          const best = sets
            .map((set) => estimateOneRepMax(set))
            .filter((value): value is number => value !== null)
            .sort((a, b) => b - a)[0];
          return {
            sessionId: session.id,
            date: session.date,
            sets,
            volume: sets.reduce((total, set) => total + setVolume(set), 0),
            e1rm: best ?? null,
            topSet: sets.reduce((top, set) =>
              (set.weightKg ?? 0) > (top.weightKg ?? 0) ? set : top,
            ),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    [sessions, id],
  );

  const e1rmPoints = entries
    .filter((entry) => entry.e1rm !== null)
    .map((entry) => ({ x: entry.date, y: entry.e1rm as number }));

  const best = e1rmPoints.reduce((max, point) => Math.max(max, point.y), 0);
  const latest = entries[entries.length - 1] ?? null;

  return (
    <Screen>
      <Header
        title={exerciseName(id)}
        subtitle={
          meta ? `${MUSCLE_GROUP_LABELS[meta.primaryMuscle]} · ${PATTERN_LABELS[meta.pattern]}` : undefined
        }
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Not logged yet"
          description="Log this exercise in a session and its history appears here."
        />
      ) : (
        <>
          <Section>
            <View style={styles.metrics}>
              <Metric label="Best e1RM" value={best > 0 ? `${best}` : '—'} unit="kg" />
              <Metric
                label="Last session"
                value={
                  latest?.topSet.weightKg !== null && latest?.topSet.reps !== null
                    ? `${latest?.topSet.weightKg} × ${latest?.topSet.reps}`
                    : '—'
                }
                size="small"
                intent="neutral"
              />
              <Metric label="Sessions" value={`${entries.length}`} size="small" intent="neutral" />
            </View>
          </Section>

          <Section title="Estimated 1RM" footnote="Epley estimate from your best working set of each session.">
            <LineChart
              points={e1rmPoints}
              xLabels={
                e1rmPoints.length > 1
                  ? [formatShortDate(e1rmPoints[0].x), formatShortDate(e1rmPoints[e1rmPoints.length - 1].x)]
                  : undefined
              }
            />
            <Note style={styles.note}>
              Estimated, not tested. Sets above 12 reps are excluded because the estimate stops being meaningful.
            </Note>
          </Section>

          <Section title="Sessions">
            {[...entries].reverse().map((entry, index) => (
              <View key={entry.sessionId}>
                {index > 0 ? <Divider /> : null}
                <MetricRow
                  label={formatShortDate(entry.date)}
                  detail={entry.sets
                    .map((set) => `${set.weightKg ?? '—'}×${set.reps ?? '—'}`)
                    .join('  ')}
                  value={`${Math.round(entry.volume).toLocaleString()} kg`}
                  onPress={() => router.push({ pathname: '/workout/[id]', params: { id: entry.sessionId } })}
                />
              </View>
            ))}
          </Section>
        </>
      )}

      {meta ? (
        <Section title="Alternatives">
          {meta.alternatives.map((alternative, index) => (
            <View key={alternative}>
              {index > 0 ? <Divider /> : null}
              <MetricRow
                label={exerciseName(alternative)}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: alternative } })}
              />
            </View>
          ))}
          {meta.alternatives.length === 0 ? (
            <Text variant="bodySmall" tone="tertiary">
              No alternatives recorded.
            </Text>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  note: {
    marginTop: spacing.lg,
  },
});
