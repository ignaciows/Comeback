import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
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
import { strategyProfile } from '@/domain/plan/strategies';
import { PhaseGrid } from '@/features/plan/PhaseGrid';
import { PlanVerdictCard, verdictActionLabel } from '@/features/plan/PlanVerdictCard';
import { VolumeBars } from '@/features/plan/VolumeBars';
import { useActiveRoutine, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { snapshotOf, useRecalcStore } from '@/store/useRecalcStore';
import { formatLongDate } from '@/utils/date';

/**
 * Where this is going, and whether you are on the way.
 *
 * This screen used to be a dashboard: ten stacked blocks and, underneath them,
 * two groups holding eleven navigation rows between them. Every one of those
 * things was worth having somewhere. None of them was worth having *here*, all
 * at once, because a screen that shows you everything has decided nothing on
 * your behalf, and deciding is the entire job.
 *
 * What is left is one argument in four beats. The date you are heading for.
 * Whether the plan you picked is the plan you are actually on. The road, as
 * phases you can count. And where the work lands on your body. Everything
 * else — the day grid, the ramp, the requirements, the history — has its own
 * screen and is one tap away, which is where detail belongs.
 */
export default function PlanTab() {
  const router = useRouter();
  const engine = useEngine();
  const goal = useAppStore((state) => state.goal);
  const routine = useActiveRoutine();
  const applyVerdictAction = useAppStore((state) => state.applyVerdictAction);
  const arm = useRecalcStore((state) => state.arm);

  const { projection, volume, verdict, weeklyTarget, phases } = engine;
  const strategy = goal ? strategyProfile(goal.strategy) : null;
  const focus = goal?.muscleFocus ?? [];

  const hasRoute = useAppStore((state) => state.planRoute !== null);
  const planHistory = useAppStore((state) => state.planHistory);
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
            Where are you heading?
          </Text>
          <Text variant="body" tone="secondary" style={styles.emptyLine}>
            Pick the shape of the next few months. You can change it whenever you like.
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
      </Screen>
    );
  }

  return (
    <Screen ambient>
      {/* The one number the whole app is counting down. */}
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
            {projection?.targetDate ? formatLongDate(projection.targetDate) : 'Set a target and this counts down to it.'}
          </Text>
        </View>
      </Reveal>

      {/* Anything that just changed lands here, counting to its new value. */}
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
            style={styles.section}
          >
            <PhaseGrid phases={phases} onPressPhase={() => router.push('/roadmap')} />
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={4}>
        <Section
          title="Where the work lands"
          action={{ label: focus.length > 0 ? 'Change' : 'Choose', onPress: () => router.push('/focus') }}
          style={styles.section}
        >
          <VolumeBars volume={volume} onPress={() => router.push('/focus')} />
          {focus.length > 0 ? (
            <Label style={styles.focusLine}>
              {`Focus · ${focus.map((muscle) => MUSCLE_GROUP_LABELS[muscle]).join(' · ')}`}
            </Label>
          ) : null}
        </Section>
      </Reveal>

      {/*
        One group, in the order someone would ask for these things: change it,
        look at it, then the two ways of looking further back. Splitting them
        into "Change it" and "Look closer" was a distinction the app understood
        and nobody else did.
      */}
      <Reveal index={5}>
        <NavGroup>
          <NavRow label="Change your plan" icon="target" detail={strategy?.label} onPress={() => router.push('/adjust')} />
          <NavRow
            label="Your lifts"
            icon="bolt"
            detail="What each movement has added up to"
            onPress={() => router.push('/lifts')}
          />
          <NavRow label="Your progress" icon="progress" onPress={() => router.push('/progress')} />
          <NavRow
            label="Every day so far"
            icon="journal"
            detail="One square per day"
            onPress={() => router.push('/journal')}
          />
          <NavRow
            label="Your routine"
            icon="train"
            value={routine ? `${routine.daysPerWeek} days` : '—'}
            onPress={() => router.push('/routine')}
          />
          <NavRow
            label="What the app worked out"
            icon="info"
            value={engine.proposals.length > 0 ? `${engine.proposals.length}` : undefined}
            tone={engine.proposals.length > 0 ? 'accent' : 'neutral'}
            dot={engine.proposals.length > 0}
            onPress={() => router.push('/knows')}
          />
          {planHistory.length > 0 ? (
            <NavRow
              label="The plan you were on"
              icon="restart"
              detail={planHistory[planHistory.length - 1].reason}
              onPress={() => router.push('/previous-plan')}
            />
          ) : null}
        </NavGroup>
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
    marginBottom: spacing.sm,
  },
  emptyLine: {
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
  section: {
    marginTop: spacing.xxl,
  },
  focusLine: {
    marginTop: spacing.md,
  },
});
