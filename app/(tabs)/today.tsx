import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { StatusPill } from '@/components/Feedback';
import { LiveDot } from '@/components/motion/Pulse';
import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { momentumStateLabel } from '@/domain/momentum/calculateMomentum';
import { strategyProfile } from '@/domain/plan/strategies';
import { readinessLabel } from '@/domain/readiness/calculateReadiness';
import { track } from '@/services/analytics/analytics';
import { useActiveSession, useEngine, useTodayCheckin } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { addDays, formatLongDate, greetingFor, today as todayOf } from '@/utils/date';

/**
 * Today answers one question — what do I do now — and nothing else appears
 * above the fold. Every other number is a row that leads somewhere; none of
 * them explain themselves here.
 */
export default function TodayScreen() {
  const router = useRouter();
  const engine = useEngine();
  const checkin = useTodayCheckin();
  const activeSession = useActiveSession();

  const profile = useAppStore((state) => state.profile);
  const goal = useAppStore((state) => state.goal);
  const startSession = useAppStore((state) => state.startSession);
  const reschedulePlannedSession = useAppStore((state) => state.reschedulePlannedSession);
  const advanceRouteBlock = useAppStore((state) => state.advanceRouteBlock);
  const plannedSessions = useAppStore((state) => state.plannedSessions);

  const applied = useAppStore((state) => state.appliedProposals);

  const date = todayOf();
  const { recommendation, momentum, readiness, week, projection, adaptation, drift, routeProgress } = engine;
  // At most one suggestion here; the rest wait on their own screen.
  const openProposal = engine.proposals.find((entry) => !applied.includes(entry.id)) ?? null;
  const todayPlanned = plannedSessions.find((entry) => entry.date === date && entry.status === 'planned') ?? null;
  const resting = recommendation.type === 'rest';

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

  const intentFor = () => {
    if (recommendation.type === 'reduced') return 'reduced' as const;
    if (recommendation.type === 'recovery') return 'recovery' as const;
    if (recommendation.type === 'free') return 'free' as const;
    return 'full' as const;
  };

  return (
    <Screen ambient>
      <Reveal index={0}>
        <View style={styles.header}>
          <Text variant="bodySmall" tone="tertiary">
            {`${greetingFor()}${profile?.name ? `, ${profile.name}` : ''} · ${formatLongDate(date)}`}
          </Text>
        </View>
      </Reveal>

      {/* The whole point of the screen. */}
      <Reveal index={1}>
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <StatusPill
              label={activeSession ? 'In progress' : resting ? 'Rest' : 'Train'}
              tone={activeSession ? 'info' : resting ? 'neutral' : 'accent'}
            />
            <View style={styles.live}>
              <LiveDot />
              <Text variant="caption" tone="tertiary">
                {`${week.completed} of ${week.target} this week`}
              </Text>
            </View>
          </View>

          <Text variant="display" style={styles.heroTitle}>
            {activeSession ? activeSession.name : recommendation.title}
          </Text>

          <Text variant="body" tone="secondary" style={styles.heroLine}>
            {activeSession
              ? 'Session in progress.'
              : resting
                ? 'Nothing scheduled. Rest is part of the plan.'
                : `${recommendation.estimatedMinutes} minutes · ${adaptation.headline.toLowerCase()}`}
          </Text>

          {!activeSession && !resting && adaptation.setDelta !== 0 ? (
            <Text variant="caption" tone="tertiary" style={styles.heroNote}>
              {adaptation.reason}
            </Text>
          ) : null}

          {activeSession ? (
            <PrimaryButton
              label="Resume"
              onPress={() => router.push({ pathname: '/session', params: { id: activeSession.id } })}
              style={styles.cta}
            />
          ) : resting ? (
            <PrimaryButton label="Train anyway" onPress={() => begin('free')} style={styles.cta} />
          ) : (
            <PrimaryButton label="Start" onPress={() => begin(intentFor())} style={styles.cta} />
          )}

          {!activeSession && todayPlanned && !resting ? (
            <TextButton
              label="Not today — move it"
              onPress={() => reschedulePlannedSession(todayPlanned.id, addDays(date, 1))}
              style={styles.skip}
            />
          ) : null}
        </View>
      </Reveal>

      <Reveal index={2}>
        <NavGroup style={styles.group}>
          <NavRow
            label="Why this session"
            onPress={() => router.push('/why')}
            value={recommendation.confidence === 'low' ? 'low confidence' : undefined}
          />
          <NavRow
            label="Check-in"
            value={checkin && readiness.score !== null ? readinessLabel(readiness.score) : 'Not logged'}
            tone={checkin ? 'neutral' : 'warning'}
            dot={!checkin}
            onPress={() => router.push('/checkin')}
          />
          <NavRow
            label="Momentum"
            value={momentum ? `${Math.round(momentum.score)}` : '—'}
            detail={momentum ? momentumStateLabel(momentum.state) : 'Log a session to start it'}
            tone={momentum && momentum.score >= 60 ? 'accent' : 'neutral'}
            onPress={() => {
              track({ name: 'momentum_viewed', state: momentum?.state ?? 'unknown' });
              router.push('/momentum');
            }}
          />
          {routeProgress?.nextBlock ? (
            <NavRow
              label={`Time to start the ${routeProgress.nextBlock.label.toLowerCase()}`}
              detail={`${routeProgress.routeName} · next block of your plan`}
              tone="accent"
              dot
              onPress={() => advanceRouteBlock(routeProgress.nextBlock!.strategy)}
            />
          ) : null}
          {drift ? (
            <NavRow
              label={drift.headline}
              detail={drift.detail}
              tone={drift.days > 0 ? 'warning' : 'accent'}
              dot
              onPress={() => router.push('/plan')}
            />
          ) : null}
          {/* Something the app worked out that is worth acting on. */}
          {openProposal ? (
            <NavRow
              label={openProposal.headline}
              detail={openProposal.detail}
              tone="accent"
              dot
              onPress={() => router.push('/knows')}
            />
          ) : null}
          <NavRow
            label="Plan"
            value={
              projection?.daysRemaining !== null && projection?.daysRemaining !== undefined
                ? `${projection.daysRemaining} days`
                : goal
                  ? strategyProfile(goal.strategy).label
                  : '—'
            }
            detail={goal ? strategyProfile(goal.strategy).label : undefined}
            onPress={() => router.push('/plan')}
          />
        </NavGroup>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xl,
  },
  hero: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  heroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroTitle: {
    marginTop: spacing.xl,
    fontSize: 40,
    lineHeight: 44,
  },
  heroLine: {
    marginTop: spacing.sm,
  },
  heroNote: {
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.xl,
  },
  skip: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  group: {
    marginTop: spacing.xl,
  },
});
