import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActivityGrid, BarRow, LineChart } from '@/components/Chart';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Metric, MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS, exerciseName, getExercise } from '@/data/exercises';
import { momentumStateLabel } from '@/domain/momentum/calculateMomentum';
import {
  bestE1rmByExercise,
  sessionVolume,
  volumeByExercise,
  volumeByMuscleGroup,
} from '@/domain/training/metrics';
import type { MuscleGroup } from '@/domain/types';
import { MilestoneTrack } from '@/features/plan/MilestoneTrack';
import { STRATEGIES } from '@/domain/plan/strategies';
import { useBodyWeightSeries, useCompletedSessions, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { addDays, daysBetween, formatLongDate, formatShortDate, lastNDays, today as todayOf } from '@/utils/date';
import { mean, round } from '@/utils/math';

const WINDOW_DAYS = 28;

export default function ProgressScreen() {
  const router = useRouter();
  const engine = useEngine();
  const sessions = useCompletedSessions();
  const weights = useBodyWeightSeries();
  const goal = useAppStore((state) => state.goal);
  const plannedSessions = useAppStore((state) => state.plannedSessions);

  const date = todayOf();
  const windowDates = useMemo(() => lastNDays(date, WINDOW_DAYS), [date]);

  const recentSessions = useMemo(
    () => sessions.filter((session) => daysBetween(session.date, date) < WINDOW_DAYS),
    [sessions, date],
  );

  const muscleVolume = useMemo(
    () =>
      volumeByMuscleGroup(recentSessions, (id) => {
        const exercise = getExercise(id);
        return exercise
          ? { primaryMuscle: exercise.primaryMuscle, secondaryMuscles: exercise.secondaryMuscles }
          : undefined;
      }),
    [recentSessions],
  );

  const exerciseVolume = useMemo(() => volumeByExercise(recentSessions), [recentSessions]);
  const exerciseBests = useMemo(() => bestE1rmByExercise(sessions), [sessions]);

  const totalVolume = useMemo(
    () => recentSessions.reduce((total, session) => total + sessionVolume(session), 0),
    [recentSessions],
  );

  const weightPoints = useMemo(
    () => weights.map((entry) => ({ x: entry.date, y: entry.weightKg })),
    [weights],
  );

  // Seven-point trailing mean: body weight is noisy day to day.
  const weightAverage = useMemo(
    () =>
      weightPoints.map((point, index) => ({
        x: point.x,
        y: round(mean(weightPoints.slice(Math.max(0, index - 6), index + 1).map((entry) => entry.y)), 2),
      })),
    [weightPoints],
  );

  const weeklyWeightChange = useMemo(() => {
    if (weights.length < 2) return null;
    const latest = weights[weights.length - 1];
    const reference = [...weights].reverse().find((entry) => daysBetween(entry.date, latest.date) >= 7);
    if (!reference) return null;
    const days = daysBetween(reference.date, latest.date) || 1;
    return round(((latest.weightKg - reference.weightKg) / days) * 7, 2);
  }, [weights]);

  const momentumPoints = useMemo(
    () => engine.momentumSeries.slice(-WINDOW_DAYS).map((snapshot) => ({ x: snapshot.date, y: snapshot.score })),
    [engine.momentumSeries],
  );

  const plannedCount = plannedSessions.filter(
    (entry) =>
      entry.status !== 'rest' && daysBetween(entry.date, date) >= 0 && daysBetween(entry.date, date) < WINDOW_DAYS,
  ).length;

  const activity = useMemo(() => {
    const trained = new Set(sessions.map((session) => session.date));
    const missed = new Set(
      plannedSessions
        .filter((entry) => entry.status === 'skipped' || (entry.status === 'planned' && entry.date < date))
        .map((entry) => entry.date),
    );
    return windowDates.map((day) => ({ date: day, active: trained.has(day), missed: missed.has(day) }));
  }, [sessions, plannedSessions, windowDates, date]);

  const topExercises = useMemo(
    () =>
      Object.entries(exerciseVolume)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    [exerciseVolume],
  );

  const maxMuscleVolume = Math.max(1, ...Object.values(muscleVolume).map((value) => value ?? 0));

  return (
    <Screen>
      <Text variant="title" style={styles.title}>
        Progress
      </Text>

      {engine.projection && goal ? (
        <Section
          title="Plan"
          action={{ label: 'Change', onPress: () => router.push('/plan') }}
          footnote={engine.projection.explanation}
        >
          <MilestoneTrack
            completed={engine.projection.sessionsCompleted}
            remaining={engine.projection.sessionsRemaining}
            targetLabel={
              goal.targetWeightKg ? `${goal.targetWeightKg.toFixed(1)} kg` : STRATEGIES[goal.strategy].label
            }
            footnote={
              engine.projection.targetDate
                ? `${STRATEGIES[goal.strategy].label} · estimated ${formatLongDate(engine.projection.targetDate)}`
                : STRATEGIES[goal.strategy].label
            }
          />
        </Section>
      ) : null}

      <Section title="Momentum" action={{ label: 'Details', onPress: () => router.push('/momentum') }}>
        {engine.momentum ? (
          <>
            <View style={styles.metricRow}>
              <Metric
                label="Now"
                value={`${Math.round(engine.momentum.score)}`}
                caption={momentumStateLabel(engine.momentum.state)}
              />
              <Metric
                label="7 days"
                value={engine.momentumDelta7 === null ? '—' : `${engine.momentumDelta7 > 0 ? '+' : ''}${engine.momentumDelta7}`}
                size="small"
                trend={
                  engine.momentumDelta7 === null
                    ? undefined
                    : engine.momentumDelta7 > 0
                      ? 'up'
                      : engine.momentumDelta7 < 0
                        ? 'down'
                        : 'flat'
                }
              />
              <Metric
                label="28 days"
                value={engine.momentumDelta28 === null ? '—' : `${engine.momentumDelta28 > 0 ? '+' : ''}${engine.momentumDelta28}`}
                size="small"
                trend={
                  engine.momentumDelta28 === null
                    ? undefined
                    : engine.momentumDelta28 > 0
                      ? 'up'
                      : engine.momentumDelta28 < 0
                        ? 'down'
                        : 'flat'
                }
              />
            </View>
            <LineChart
              points={momentumPoints}
              domain={[0, 100]}
              xLabels={[formatShortDate(addDays(date, -(WINDOW_DAYS - 1))), 'Today']}
              style={styles.chart}
            />
          </>
        ) : (
          <EmptyState
            title="Not enough data yet"
            description="Momentum starts once there is something to measure — log a session or a check-in."
          />
        )}
      </Section>

      <Section title="Consistency" footnote={`Last ${WINDOW_DAYS} days.`}>
        <View style={styles.metricRow}>
          <Metric label="Completed" value={`${recentSessions.length}`} size="small" />
          <Metric label="Planned" value={`${plannedCount}`} size="small" intent="neutral" />
          <Metric
            label="Per week"
            value={`${round(recentSessions.length / (WINDOW_DAYS / 7), 1)}`}
            size="small"
            caption={`Target ${engine.week.target}`}
          />
        </View>
        <View style={styles.chart}>
          <ActivityGrid days={activity} />
        </View>
      </Section>

      <Section
        title="Body weight"
        action={{ label: 'Log', onPress: () => router.push('/log-weight') }}
        footnote={weights.length > 1 ? 'Line is each entry; the lighter line is a seven-entry average.' : undefined}
      >
        {weights.length === 0 ? (
          <EmptyState
            title="No weight logged"
            description="One entry a week is enough for the trend to mean something."
            action={{ label: 'Log weight', onPress: () => router.push('/log-weight') }}
          />
        ) : (
          <>
            <View style={styles.metricRow}>
              <Metric
                label="Current"
                value={weights[weights.length - 1].weightKg.toFixed(2)}
                unit="kg"
                caption={formatShortDate(weights[weights.length - 1].date)}
              />
              <Metric
                label="Weekly change"
                value={weeklyWeightChange === null ? '—' : `${weeklyWeightChange > 0 ? '+' : ''}${weeklyWeightChange}`}
                unit={weeklyWeightChange === null ? undefined : 'kg'}
                size="small"
                intent="neutral"
              />
              {goal?.targetWeightKg ? (
                <Metric label="Target" value={goal.targetWeightKg.toFixed(1)} unit="kg" size="small" intent="neutral" />
              ) : null}
            </View>
            <LineChart
              points={weightPoints}
              average={weightAverage}
              color={colors.text}
              xLabels={[formatShortDate(weights[0].date), formatShortDate(weights[weights.length - 1].date)]}
              style={styles.chart}
            />
          </>
        )}
      </Section>

      <Section title="Training volume" footnote={`Tonnage over the last ${WINDOW_DAYS} days.`}>
        {recentSessions.length === 0 ? (
          <EmptyState title="No sessions in this window" description="Volume appears once you log a session." />
        ) : (
          <>
            <Metric
              label="Total"
              value={Math.round(totalVolume).toLocaleString()}
              unit="kg"
              caption={`${recentSessions.length} sessions`}
            />
            <View style={styles.chart}>
              {(Object.keys(muscleVolume) as MuscleGroup[])
                .sort((a, b) => (muscleVolume[b] ?? 0) - (muscleVolume[a] ?? 0))
                .map((muscle) => (
                  <BarRow
                    key={muscle}
                    label={MUSCLE_GROUP_LABELS[muscle]}
                    value={muscleVolume[muscle] ?? 0}
                    max={maxMuscleVolume}
                    valueLabel={`${Math.round(muscleVolume[muscle] ?? 0).toLocaleString()} kg`}
                  />
                ))}
            </View>
          </>
        )}
      </Section>

      <Section title="Exercises" footnote="Estimated 1RM uses Epley on your best working set; it is an estimate.">
        {topExercises.length === 0 ? (
          <EmptyState title="Nothing logged yet" description="Per-exercise history appears after your first session." />
        ) : (
          topExercises.map(([exerciseId, volume], index) => (
            <View key={exerciseId}>
              {index > 0 ? <Divider /> : null}
              <MetricRow
                label={exerciseName(exerciseId)}
                detail={`${Math.round(volume).toLocaleString()} kg in ${WINDOW_DAYS} days`}
                value={exerciseBests[exerciseId] ? `${exerciseBests[exerciseId]} kg e1RM` : '—'}
                onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exerciseId } })}
              />
            </View>
          ))
        )}
      </Section>

      <Section title="Comeback progress">
        {engine.comeback.value === null ? (
          <EmptyState
            title="Establishing your baseline"
            description={engine.comeback.explanation}
          />
        ) : (
          <>
            <View style={styles.comebackHead}>
              <Metric label="Recovered" value={`${Math.round(engine.comeback.value)}`} unit="%" />
              <StatusPill
                label={`${engine.comeback.confidence} confidence`}
                tone={engine.comeback.confidence === 'high' ? 'accent' : engine.comeback.confidence === 'medium' ? 'info' : 'neutral'}
              />
            </View>
            <View style={styles.chart}>
              <MetricRow
                label="Strength"
                value={engine.comeback.components.strength === null ? '—' : `${Math.round(engine.comeback.components.strength)}%`}
              />
              <Divider />
              <MetricRow
                label="Volume"
                value={engine.comeback.components.volume === null ? '—' : `${Math.round(engine.comeback.components.volume)}%`}
              />
              <Divider />
              <MetricRow
                label="Frequency"
                value={engine.comeback.components.frequency === null ? '—' : `${Math.round(engine.comeback.components.frequency)}%`}
              />
            </View>
            <Note style={styles.note}>{engine.comeback.explanation}</Note>
          </>
        )}
      </Section>

      {engine.trajectory ? (
        <Section title="Trajectory" footnote={engine.trajectory.explanation}>
          <MetricRow label="Estimated target date" value={formatLongDate(engine.trajectory.targetDate)} />
          <Divider />
          <MetricRow
            label="Versus original plan"
            value={`${engine.trajectory.driftDays > 0 ? '+' : ''}${engine.trajectory.driftDays}d`}
          />
          <Divider />
          <MetricRow label="Sessions remaining" value={`${engine.trajectory.remainingSessions}`} />
          <Note style={styles.note}>
            {`Model estimate at ${engine.trajectory.confidence} confidence, not a prediction.`}
          </Note>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xxl,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  chart: {
    marginTop: spacing.xl,
  },
  comebackHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  note: {
    marginTop: spacing.lg,
  },
});
