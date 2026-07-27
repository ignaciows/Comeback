import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Button';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { MetricRow } from '@/components/Metric';
import { DayStrip } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { readinessLabel } from '@/domain/readiness/calculateReadiness';
import { recommendationTypeLabel } from '@/domain/recommendations/generateDailyRecommendation';
import { MomentumIndicator } from '@/features/momentum/MomentumIndicator';
import { track } from '@/services/analytics/analytics';
import { useActiveSession, useEngine, useTodayCheckin } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { addDays, formatLongDate, formatRelativeDay, greetingFor, today as todayOf } from '@/utils/date';

export default function TodayScreen() {
  const router = useRouter();
  const engine = useEngine();
  const checkin = useTodayCheckin();
  const activeSession = useActiveSession();

  const profile = useAppStore((state) => state.profile);
  const startSession = useAppStore((state) => state.startSession);
  const reschedulePlannedSession = useAppStore((state) => state.reschedulePlannedSession);
  const plannedSessions = useAppStore((state) => state.plannedSessions);

  const date = todayOf();
  const { recommendation, momentum, readiness, week, trajectory, lastSession, daysSinceLastSession } = engine;
  const todayPlanned = plannedSessions.find((entry) => entry.date === date && entry.status === 'planned') ?? null;

  const begin = (intent: 'full' | 'reduced' | 'recovery' | 'free') => {
    const id = startSession({
      routineId: recommendation.routineId,
      routineDayId: recommendation.routineDayId,
      intent,
      name: intent === 'recovery' ? 'Recovery session' : recommendation.title,
      plannedSessionId: todayPlanned?.id ?? null,
    });
    track({ name: 'recommendation_followed', type: recommendation.type });
    router.push({ pathname: '/session', params: { id } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{`${greetingFor()}${profile ? `, ${profile.name}` : ''}`}</Text>
        <Text variant="bodySmall" tone="secondary" style={styles.date}>
          {`${formatLongDate(date)} · ${week.completed} of ${week.target} sessions this week`}
        </Text>
      </View>

      <Section>
        <MomentumIndicator
          score={momentum?.score ?? null}
          state={momentum?.state ?? 'stable'}
          delta={engine.momentumDelta7}
          confidence={momentum?.confidence ?? 'low'}
          explanation={
            momentum?.explanation ??
            'Momentum starts once you log a session or a check-in. Nothing is estimated before then.'
          }
          onPress={() => {
            track({ name: 'momentum_viewed', state: momentum?.state ?? 'unknown' });
            router.push('/momentum');
          }}
        />
      </Section>

      <Section title="Today">
        {activeSession ? (
          <>
            <Text variant="title">{activeSession.name}</Text>
            <Text variant="bodySmall" tone="secondary" style={styles.reason}>
              A session is already in progress.
            </Text>
            <PrimaryButton
              label="Resume session"
              onPress={() => router.push({ pathname: '/session', params: { id: activeSession.id } })}
              style={styles.action}
            />
          </>
        ) : (
          <>
            <View style={styles.recommendationHead}>
              <StatusPill
                label={recommendationTypeLabel[recommendation.type]}
                tone={
                  recommendation.type === 'rest'
                    ? 'neutral'
                    : recommendation.type === 'recovery' || recommendation.type === 'reduced'
                      ? 'warning'
                      : 'accent'
                }
              />
              {recommendation.estimatedMinutes > 0 ? (
                <Text variant="caption" tone="tertiary" mono>
                  {`${recommendation.estimatedMinutes} min`}
                </Text>
              ) : null}
            </View>
            <Text variant="title" style={styles.recommendationTitle}>
              {recommendation.title}
            </Text>
            <Text variant="bodySmall" tone="secondary" style={styles.reason}>
              {recommendation.reason}
            </Text>

            {recommendation.type === 'rest' ? (
              <View style={styles.action}>
                {todayPlanned ? (
                  <PrimaryButton
                    label="Move session to tomorrow"
                    onPress={() => reschedulePlannedSession(todayPlanned.id, addDays(date, 1))}
                  />
                ) : null}
                <SecondaryButton label="Train anyway" onPress={() => begin('free')} style={styles.secondary} />
              </View>
            ) : (
              <View style={styles.action}>
                <PrimaryButton
                  label={`Start ${recommendation.type === 'recovery' ? 'recovery' : 'session'}`}
                  onPress={() =>
                    begin(
                      recommendation.type === 'reduced'
                        ? 'reduced'
                        : recommendation.type === 'recovery'
                          ? 'recovery'
                          : recommendation.type === 'free'
                            ? 'free'
                            : 'full',
                    )
                  }
                />
                {recommendation.type !== 'free' && todayPlanned ? (
                  <SecondaryButton
                    label="Move to tomorrow"
                    onPress={() => reschedulePlannedSession(todayPlanned.id, addDays(date, 1))}
                    style={styles.secondary}
                  />
                ) : null}
              </View>
            )}

            <View style={styles.factors}>
              {recommendation.factors.map((factor) => (
                <View key={factor.key} style={styles.factorRow}>
                  <View
                    style={[
                      styles.factorDot,
                      {
                        backgroundColor:
                          factor.direction === 'positive'
                            ? colors.accent
                            : factor.direction === 'negative'
                              ? colors.warning
                              : colors.borderStrong,
                      },
                    ]}
                  />
                  <Text variant="caption" tone="tertiary">
                    {factor.label}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Section>

      <Section
        title="Readiness"
        action={{ label: checkin ? 'Edit' : 'Log', onPress: () => router.push('/checkin') }}
      >
        {checkin && readiness.score !== null ? (
          <>
            <View style={styles.readinessHead}>
              <Text variant="metricSmall" mono>
                {Math.round(readiness.score)}
              </Text>
              <Text variant="bodySmall" tone="secondary">
                {readinessLabel(readiness.score)}
                {readiness.vsBaseline !== null
                  ? ` · ${readiness.vsBaseline >= 0 ? '+' : ''}${Math.round(readiness.vsBaseline)} vs baseline`
                  : ''}
              </Text>
            </View>
            <View style={styles.readinessGrid}>
              {readiness.breakdown
                .filter((item) => item.score !== null)
                .map((item) => (
                  <View key={item.key} style={styles.readinessItem}>
                    <Label>{item.label}</Label>
                    <Text variant="bodySmall" mono tone="secondary">
                      {Math.round(item.score as number)}
                    </Text>
                  </View>
                ))}
            </View>
            {readiness.baseline === null ? (
              <Note style={styles.note}>
                Your personal baseline needs three check-ins. Until then readiness is shown on its own.
              </Note>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="No check-in today"
            description="Sleep, energy and soreness decide whether today's session should be full, reduced or skipped."
            action={{ label: 'Log check-in', onPress: () => router.push('/checkin') }}
          />
        )}
      </Section>

      {trajectory ? (
        <Section title="Trajectory" footnote={trajectory.explanation}>
          <MetricRow label="Estimated target date" value={formatLongDate(trajectory.targetDate)} />
          <Divider />
          <MetricRow
            label="Skipping today"
            value={`+${trajectory.skipCostDays}d`}
            detail="Estimated delay at your current pace"
          />
          {trajectory.recoverableDays > 0 ? (
            <>
              <Divider />
              <MetricRow
                label="Three consistent weeks"
                value={`−${trajectory.recoverableDays}d`}
                detail="Estimated recovery if you hit your target frequency"
              />
            </>
          ) : null}
          <Note style={styles.note}>
            {`These are model estimates, not predictions. Confidence: ${trajectory.confidence}.`}
          </Note>
        </Section>
      ) : null}

      <Section title="This week">
        <DayStrip days={week.days.map((day) => ({ key: day.date, state: day.state }))} />
        <View style={styles.weekRow}>
          <Text variant="caption" tone="tertiary">
            {`${week.completed} completed`}
          </Text>
          <Text variant="caption" tone="tertiary">
            {`${Math.max(0, week.target - week.completed)} remaining`}
          </Text>
        </View>
      </Section>

      <Section title="Recent activity">
        <MetricRow
          label="Last session"
          value={lastSession ? formatRelativeDay(lastSession.date, date) : 'None yet'}
          detail={lastSession?.name}
        />
        <Divider />
        <MetricRow
          label="Days since training"
          value={daysSinceLastSession === null ? '—' : `${daysSinceLastSession}`}
        />
        <Divider />
        <MetricRow
          label="Next planned"
          value={engine.nextPlanned ? formatRelativeDay(engine.nextPlanned.date, date) : 'Not scheduled'}
        />
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xxl,
  },
  date: {
    marginTop: spacing.xs,
  },
  recommendationHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recommendationTitle: {
    marginTop: spacing.md,
  },
  reason: {
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.xl,
  },
  secondary: {
    marginTop: spacing.md,
  },
  factors: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  factorDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  readinessHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  readinessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.lg,
    rowGap: spacing.lg,
  },
  readinessItem: {
    width: '33%',
    gap: 2,
  },
  note: {
    marginTop: spacing.lg,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
});
