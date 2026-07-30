import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusPill } from '@/components/Feedback';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Recalculation } from '@/components/motion/Recalculation';
import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Icon, type IconName } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import { buildJournal, futureDays, summariseJournal } from '@/domain/journal';
import { revertSuggestion } from '@/domain/plan/history';
import { strategyProfile } from '@/domain/plan/strategies';
import { DayGrid } from '@/features/plan/DayGrid';
import { PathTrack, pathWeeksFrom } from '@/features/plan/PathTrack';
import { PhaseTrack } from '@/features/plan/PhaseTrack';
import { PlanVerdictCard, verdictActionLabel } from '@/features/plan/PlanVerdictCard';
import { RequirementList } from '@/features/plan/RequirementList';
import { VolumeBars } from '@/features/plan/VolumeBars';
import { useActiveRoutine, useCompletedSessions, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { snapshotOf, useRecalcStore } from '@/store/useRecalcStore';
import { formatLongDate, startOfWeek, today as todayOf } from '@/utils/date';

/**
 * The plan: what it needs from you, and whether you are giving it.
 *
 * The order is the argument. First whether the plan you picked is the plan you
 * are actually on, then the road ahead as circles to fill, then what the plan
 * costs. Nothing here asks how many days you can train — that is the plan's
 * requirement, and this screen exists to show it and check it.
 */
export default function PlanTab() {
  const router = useRouter();
  const engine = useEngine();
  const sessions = useCompletedSessions();
  const goal = useAppStore((state) => state.goal);
  const routine = useActiveRoutine();
  const applyVerdictAction = useAppStore((state) => state.applyVerdictAction);
  const allSessions = useAppStore((state) => state.sessions);
  const plannedSessions = useAppStore((state) => state.plannedSessions);
  const checkins = useAppStore((state) => state.checkins);
  const measurements = useAppStore((state) => state.bodyMeasurements);
  const arm = useRecalcStore((state) => state.arm);

  const { projection, volume, routeProgress, drift, verdict, commitments, ramp, weeklyTarget, phases } = engine;
  const strategy = goal ? strategyProfile(goal.strategy) : null;
  const focus = goal?.muscleFocus ?? [];
  const weekStart = startOfWeek(todayOf());

  const weeks = useMemo(() => {
    const byWeek = new Map<string, number>();
    for (const session of sessions) {
      const start = startOfWeek(session.date);
      byWeek.set(start, (byWeek.get(start) ?? 0) + 1);
    }
    return pathWeeksFrom(ramp, byWeek, weekStart);
  }, [sessions, ramp, weekStart]);

  const grid = useMemo(() => {
    const past = buildJournal({
      today: todayOf(),
      days: 56,
      sessions: allSessions,
      plannedSessions,
      checkins,
      measurements,
    });
    return [...past, ...futureDays(todayOf(), 14, plannedSessions)];
  }, [allSessions, plannedSessions, checkins, measurements]);
  const journal = useMemo(() => summariseJournal(grid), [grid]);

  const hasRoute = useAppStore((state) => state.planRoute !== null);
  const planHistory = useAppStore((state) => state.planHistory);
  const notSticking = revertSuggestion(planHistory, allSessions, todayOf());
  const actionLabel = verdictActionLabel(verdict);

  const act = () => {
    if (!verdict.action) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    arm(snapshotOf(engine), verdict.headline);
    applyVerdictAction(verdict.action);
  };

  // Nothing is worth showing above a plan that does not exist yet.
  if (!hasRoute) {
    return (
      <Screen ambient>
        <Reveal index={0}>
          <Text variant="title" style={styles.emptyTitle}>
            Your plan
          </Text>
        </Reveal>

        <Reveal index={1}>
          <View style={styles.choices}>
            <PlanChoice
              icon="progress"
              title="Choose one"
              detail="Build then cut, lean build, cut first — with the curve drawn."
              onPress={() => router.push('/routes')}
              primary
            />
            <PlanChoice
              icon="edit"
              title="Build your own"
              detail="Drag the blocks. Everything recalculates as you move them."
              onPress={() => router.push('/builder')}
            />
          </View>
        </Reveal>

        <Reveal index={2}>
          <NavGroup style={styles.group}>
            <NavRow label="Change the outcome" icon="target" onPress={() => router.push('/adjust')} />
            <NavRow label="Progress" icon="progress" onPress={() => router.push('/progress')} />
          </NavGroup>
        </Reveal>
      </Screen>
    );
  }

  return (
    <Screen ambient>
      <Reveal index={0}>
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <StatusPill label={strategy?.label ?? 'No plan'} tone="accent" />
            <Text variant="caption" tone="tertiary">
              {`${weeklyTarget}× a week`}
            </Text>
          </View>

          <Label style={styles.heroLabel}>Days to your target</Label>

          <View style={styles.heroValue}>
            <AnimatedNumber value={projection?.daysRemaining ?? null} variant="display" style={styles.heroNumber} />
          </View>

          <Text variant="body" tone="secondary">
            {projection?.targetDate
              ? formatLongDate(projection.targetDate)
              : 'Set a target and this counts down to it.'}
          </Text>
        </View>
      </Reveal>

      {/* Anything just changed lands here, counting to its new value. */}
      <Reveal index={1}>
        <View style={styles.recalc}>
          <Recalculation engine={engine} />
        </View>
      </Reveal>

      <Reveal index={2}>
        <PlanVerdictCard
          verdict={verdict}
          actionLabel={actionLabel ?? undefined}
          onAct={actionLabel ? act : undefined}
          style={styles.verdict}
        />
      </Reveal>

      {phases.length > 0 ? (
        <Reveal index={3}>
          <Section
            title="The road"
            action={{ label: 'See it all', onPress: () => router.push('/roadmap') }}
            footnote={`${phases.length} phases · what to eat and how to train in each`}
          >
            <PhaseTrack phases={phases} />
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={3}>
        <Section
          title="The next weeks"
          footnote={
            ramp.weeksToTarget > 0
              ? `Building to ${ramp.targetDays} a week over ${ramp.weeksToTarget} weeks, from the ${ramp.startDays} you do now.`
              : undefined
          }
        >
          <PathTrack weeks={weeks} />
        </Section>
      </Reveal>

      <Reveal index={4}>
        <Section
          title="Days"
          action={{ label: 'Journal', onPress: () => router.push('/journal') }}
          footnote={
            journal.trained > 0
              ? `${journal.trained} trained · best run ${journal.streak} days`
              : 'Every day you train fills a square.'
          }
        >
          <DayGrid days={grid} onPressDay={() => router.push('/journal')} />
        </Section>
      </Reveal>

      <Reveal index={5}>
        <Section title="What this plan needs">
          <RequirementList commitments={commitments} />
        </Section>
      </Reveal>

      <Reveal index={6}>
        <Section
          title="Where the work goes"
          action={{ label: focus.length > 0 ? 'Change' : 'Choose', onPress: () => router.push('/focus') }}
        >
          <VolumeBars volume={volume} onPress={() => router.push('/focus')} />
          {focus.length > 0 ? (
            <Label style={styles.focusLine}>
              {`Focus · ${focus.map((muscle) => MUSCLE_GROUP_LABELS[muscle]).join(' · ')}`}
            </Label>
          ) : null}
        </Section>
      </Reveal>

      {/* Anything that needs attention, and only that. */}
      {routeProgress?.nextBlock || drift || notSticking ? (
        <Reveal index={7}>
          <NavGroup style={styles.group}>
            {routeProgress?.nextBlock ? (
              <NavRow
                label={`Start the ${routeProgress.nextBlock.label.toLowerCase()}`}
                detail={routeProgress.routeName}
                tone="accent"
                dot
                onPress={() => router.push('/routes')}
              />
            ) : null}
            {drift ? (
              <NavRow
                label={drift.headline}
                detail={drift.detail}
                tone={drift.days > 0 ? 'warning' : 'accent'}
                dot
                onPress={() => router.push('/why')}
              />
            ) : null}
            {/* Only on evidence: the plan changed, enough time passed, and
                training dropped off since. Never as a nudge. */}
            {notSticking ? (
              <NavRow
                label={notSticking.headline}
                detail={notSticking.detail}
                tone="warning"
                dot
                onPress={() => router.push('/previous-plan')}
              />
            ) : null}
          </NavGroup>
        </Reveal>
      ) : null}

      {/*
        Two groups, because a flat list of ten identical rows is how a screen
        stops being navigable. Changing the plan and inspecting it are different
        intentions, and the sections above already own their own destinations —
        muscle focus and the journal are reachable by tapping the very things
        that display them, so repeating them down here was three routes to the
        same place and no clue which one to take.
      */}
      <Reveal index={8}>
        <Section title="Change it">
          <NavGroup style={styles.group}>
            <NavRow label="Change the plan" icon="target" onPress={() => router.push('/adjust')} />
            {planHistory.length > 0 ? (
              <NavRow
                label="The plan you were on"
                icon="restart"
                detail={planHistory[planHistory.length - 1].reason}
                onPress={() => router.push('/previous-plan')}
              />
            ) : null}
            <NavRow label="Build your own" icon="edit" detail="Drag the blocks" onPress={() => router.push('/builder')} />
            {routeProgress?.nextBlock ? null : (
              <NavRow
                label="Named plans"
                icon="progress"
                detail={routeProgress?.routeName ?? 'Bulk then cut, lean, recomp'}
                onPress={() => router.push('/routes')}
              />
            )}
          </NavGroup>
        </Section>
      </Reveal>

      <Reveal index={9}>
        <Section title="Look closer">
          <NavGroup style={styles.group}>
            <NavRow
              label="Routine"
              icon="train"
              value={routine ? `${routine.daysPerWeek} days` : '—'}
              detail={routine?.name}
              onPress={() => router.push('/routine')}
            />
            <NavRow label="Progress" icon="progress" onPress={() => router.push('/progress')} />
            <NavRow
              label="Your body"
              icon="body"
              detail="Now, and at the end of each phase"
              onPress={() => router.push('/body-shape')}
            />
            <NavRow
              label="What the app worked out"
              icon="bolt"
              value={engine.proposals.length > 0 ? `${engine.proposals.length}` : undefined}
              tone={engine.proposals.length > 0 ? 'accent' : 'neutral'}
              dot={engine.proposals.length > 0}
              onPress={() => router.push('/knows')}
            />
          </NavGroup>
        </Section>
      </Reveal>
    </Screen>
  );
}

/** One of the two ways into a plan, as a card rather than a list row. */
function PlanChoice({
  icon,
  title,
  detail,
  onPress,
  primary = false,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onPress: () => void;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [
        styles.choice,
        primary ? styles.choicePrimary : null,
        pressed && { opacity: opacity.pressed },
      ]}
    >
      <Icon name={icon} size={22} color={primary ? colors.accent : colors.textSecondary} />
      <Text variant="heading" style={styles.choiceTitle}>
        {title}
      </Text>
      <Text variant="bodySmall" tone="secondary">
        {detail}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emptyTitle: {
    marginBottom: spacing.xl,
  },
  choices: {
    gap: spacing.md,
  },
  choice: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  choicePrimary: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
  },
  choiceTitle: {
    marginTop: spacing.sm,
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
  heroLabel: {
    marginTop: spacing.lg,
  },
  heroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  heroNumber: {
    // The one number the whole app is counting down. It earns the size.
    fontSize: 84,
    lineHeight: 88,
  },
  recalc: {
    marginTop: spacing.lg,
  },
  verdict: {
    marginTop: spacing.lg,
  },
  focusLine: {
    marginTop: spacing.md,
  },
  group: {
    marginTop: spacing.xl,
  },
});
