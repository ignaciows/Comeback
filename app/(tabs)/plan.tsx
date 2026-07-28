import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { StatusPill } from '@/components/Feedback';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Recalculation } from '@/components/motion/Recalculation';
import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import { strategyProfile } from '@/domain/plan/strategies';
import { MilestoneTrack } from '@/features/plan/MilestoneTrack';
import { VolumeBars } from '@/features/plan/VolumeBars';
import { useActiveRoutine, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatLongDate } from '@/utils/date';

/**
 * The plan, as it stands right now.
 *
 * One number above the fold — how long is left — then the two pictures that
 * say whether it is on track: how many sessions remain, and where the work is
 * going. Everything that changes the plan is a row underneath, so this screen
 * shows and the next one decides.
 */
export default function PlanTab() {
  const router = useRouter();
  const engine = useEngine();
  const goal = useAppStore((state) => state.goal);
  const routine = useActiveRoutine();

  const { projection, volume, routeProgress, drift } = engine;
  const strategy = goal ? strategyProfile(goal.strategy) : null;
  const focus = goal?.muscleFocus ?? [];

  return (
    <Screen ambient>
      <Reveal index={0}>
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <StatusPill label={strategy?.label ?? 'No plan'} tone="accent" />
            {projection ? (
              <Text variant="caption" tone="tertiary">
                {projection.confidence === 'high' ? 'On measured data' : `${projection.confidence} confidence`}
              </Text>
            ) : null}
          </View>

          <View style={styles.heroValue}>
            <AnimatedNumber value={projection?.daysRemaining ?? null} variant="display" style={styles.heroNumber} />
            <Text variant="title" tone="tertiary">
              {projection?.daysRemaining === null || projection?.daysRemaining === undefined ? '' : 'days'}
            </Text>
          </View>

          <Text variant="bodySmall" tone="secondary">
            {projection?.targetDate
              ? formatLongDate(projection.targetDate)
              : 'Set a target and this counts down to it.'}
          </Text>
        </View>
      </Reveal>

      {/* Anything the user just changed lands here, counting to its new value. */}
      <Reveal index={1}>
        <View style={styles.recalc}>
          <Recalculation engine={engine} />
        </View>
      </Reveal>

      {projection ? (
        <Reveal index={2}>
          <View style={styles.block}>
            <MilestoneTrack
              completed={projection.sessionsCompleted}
              remaining={projection.sessionsRemaining}
              targetLabel={projection.targetWeightKg ? `${projection.targetWeightKg.toFixed(1)} kg` : 'your target'}
              footnote={projection.targetDate ? `Target ${formatLongDate(projection.targetDate)}` : undefined}
            />
          </View>
        </Reveal>
      ) : null}

      <Reveal index={3}>
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

      <Reveal index={4}>
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
            <NavRow label={drift.headline} detail={drift.detail} tone={drift.days > 0 ? 'warning' : 'accent'} dot onPress={() => router.push('/why')} />
          ) : null}
          <NavRow label="Change the plan" detail="Outcome, speed, calories" onPress={() => router.push('/adjust')} />
          <NavRow
            label="Named plans"
            detail={routeProgress?.routeName ?? 'Bulk then cut, lean, recomp'}
            onPress={() => router.push('/routes')}
          />
          <NavRow
            label="Muscle focus"
            value={focus.length > 0 ? `${focus.length}` : undefined}
            detail={focus.length === 0 ? 'Balanced' : focus.map((muscle) => MUSCLE_GROUP_LABELS[muscle]).join(', ')}
            onPress={() => router.push('/focus')}
          />
          <NavRow
            label="Routine"
            value={routine ? `${routine.daysPerWeek} days` : '—'}
            detail={routine?.name}
            onPress={() => router.push('/routine')}
          />
          <NavRow
            label="What the app worked out"
            value={engine.proposals.length > 0 ? `${engine.proposals.length}` : undefined}
            tone={engine.proposals.length > 0 ? 'accent' : 'neutral'}
            dot={engine.proposals.length > 0}
            onPress={() => router.push('/knows')}
          />
          <NavRow label="Progress" detail="Momentum, body, lifts" onPress={() => router.push('/progress')} />
        </NavGroup>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  heroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroNumber: {
    fontSize: 56,
    lineHeight: 60,
  },
  recalc: {
    marginTop: spacing.lg,
  },
  block: {
    marginTop: spacing.xl,
  },
  focusLine: {
    marginTop: spacing.md,
  },
  group: {
    marginTop: spacing.xl,
  },
});
