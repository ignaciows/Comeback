import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, SecondaryButton } from '@/components/Button';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { MetricRow } from '@/components/Metric';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { LiveIndicator } from '@/components/motion/Pulse';
import { Reveal } from '@/components/motion/Reveal';
import { DayStrip } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { momentumStateLabel } from '@/domain/momentum/calculateMomentum';
import { readinessLabel } from '@/domain/readiness/calculateReadiness';
import { recommendationTypeLabel } from '@/domain/recommendations/generateDailyRecommendation';
import { STRATEGIES } from '@/domain/plan/strategies';
import { MomentumRing } from '@/features/momentum/MomentumRing';
import { MilestoneTrack } from '@/features/plan/MilestoneTrack';
import { track } from '@/services/analytics/analytics';
import { useActiveSession, useEngine, useTodayCheckin } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { addDays, formatLongDate, formatRelativeDay, greetingFor, today as todayOf } from '@/utils/date';
import { formatSince, timeOfDayPhrase, timeOfDay } from '@/utils/time';

/** Colour for each momentum state, from the restricted palette. */
const STATE_COLOR: Record<string, string> = {
  strong: colors.accent,
  building: colors.accent,
  recovering: colors.info,
  stable: colors.textSecondary,
  at_risk: colors.warning,
  declining: colors.danger,
};

export default function TodayScreen() {
  const router = useRouter();
  const engine = useEngine();
  const checkin = useTodayCheckin();
  const activeSession = useActiveSession();

  const profile = useAppStore((state) => state.profile);
  const goal = useAppStore((state) => state.goal);
  const startSession = useAppStore((state) => state.startSession);
  const reschedulePlannedSession = useAppStore((state) => state.reschedulePlannedSession);
  const plannedSessions = useAppStore((state) => state.plannedSessions);

  const date = todayOf();
  const { recommendation, momentum, readiness, week, projection, lastSession, daysSinceLastSession } = engine;
  const todayPlanned = plannedSessions.find((entry) => entry.date === date && entry.status === 'planned') ?? null;

  // "Updated Xm ago" is real: the models rerun whenever the data behind them
  // changes, and this marks the last time that happened.
  const recomputedAt = useRef(Date.now());
  const [, forceTick] = useState(0);
  useEffect(() => {
    recomputedAt.current = Date.now();
    forceTick((value) => value + 1);
  }, [momentum?.score, readiness.score, recommendation.type, week.completed]);
  useEffect(() => {
    const interval = setInterval(() => forceTick((value) => value + 1), 15_000);
    return () => clearInterval(interval);
  }, []);

  const begin = (intent: 'full' | 'reduced' | 'recovery' | 'free') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  const state = momentum?.state ?? 'stable';

  return (
    <Screen ambient>
      <Reveal index={0}>
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <Text variant="title">{`${greetingFor()}${profile?.name ? `, ${profile.name}` : ''}`}</Text>
            <LiveIndicator label={formatSince(recomputedAt.current)} />
          </View>
          <Text variant="bodySmall" tone="secondary" style={styles.date}>
            {`${formatLongDate(date)} · ${week.completed} of ${week.target} sessions this week`}
          </Text>
        </View>
      </Reveal>

      <Reveal index={1}>
        <Section>
          <MomentumRing
            score={momentum?.score ?? null}
            color={STATE_COLOR[state] ?? colors.textSecondary}
            label={momentumStateLabel(state)}
          />
          <MetricRow
            label="What moved it"
            detail={
              momentum?.explanation ??
              'Momentum starts once you log a session or a check-in. Nothing is estimated before then.'
            }
            onPress={() => {
              track({ name: 'momentum_viewed', state });
              router.push('/momentum');
            }}
          />
        </Section>
      </Reveal>

      <Reveal index={2}>
        <Section title={`Plan for ${timeOfDayPhrase(timeOfDay())}`}>
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
      </Reveal>

      <Reveal index={3}>
        <Section
          title="Readiness"
          action={{ label: checkin ? 'Edit' : 'Log', onPress: () => router.push('/checkin') }}
        >
          {checkin && readiness.score !== null ? (
            <>
              <View style={styles.readinessHead}>
                <AnimatedNumber value={readiness.score} variant="metricSmall" />
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
      </Reveal>

      {projection && goal ? (
        <Reveal index={4}>
          <Section
            title="Your plan"
            action={{ label: 'Change', onPress: () => router.push('/plan') }}
            footnote={projection.explanation}
          >
            <MilestoneTrack
              completed={projection.sessionsCompleted}
              remaining={projection.sessionsRemaining}
              targetLabel={
                goal.targetWeightKg ? `${goal.targetWeightKg.toFixed(1)} kg` : STRATEGIES[goal.strategy].label
              }
              footnote={
                projection.targetDate
                  ? `${STRATEGIES[goal.strategy].label} · estimated ${formatLongDate(projection.targetDate)}`
                  : STRATEGIES[goal.strategy].label
              }
            />
            {projection.daysRemaining !== null ? (
              <View style={styles.planRow}>
                <MetricRow
                  label="Skipping today"
                  detail="Estimated delay at your current pace"
                  value={`+${engine.trajectory?.skipCostDays ?? 1}d`}
                />
              </View>
            ) : null}
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={5}>
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
      </Reveal>

      <Reveal index={6}>
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
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
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
  planRow: {
    marginTop: spacing.md,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
});
