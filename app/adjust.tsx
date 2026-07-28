import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/Button';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { NumberInput } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { PROJECTION_CAVEAT } from '@/data/trainingPrinciples';
import {
  FAT_TOLERANCE_LABELS,
  OBJECTIVE_LABELS,
  SPEEDS,
  SPEED_LABELS,
  compareSpeeds,
  simulatePlan,
  suggestTargetWeight,
  type SimulationInput,
} from '@/domain/plan/simulate';
import type { FatTolerance, PlanObjective, PlanSpeed } from '@/domain/types';
import { useBodyWeightSeries, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { snapshotOf, useRecalcStore } from '@/store/useRecalcStore';
import { formatLongDate } from '@/utils/date';
import { today as todayOf } from '@/utils/date';

const HORIZONS = [6, 12, 24];

/**
 * The plan simulator.
 *
 * You choose the outcome — what you want, how fast, how much fat you will
 * accept — and the app works out what that takes: how many sessions a week,
 * how many calories, how long it lasts. Nothing here asks you to know training
 * theory; it shows the consequences of each choice and lets you pick.
 */
export default function AdjustPlanScreen() {
  const router = useRouter();
  const engine = useEngine();
  const goal = useAppStore((state) => state.goal);
  const profile = useAppStore((state) => state.profile);
  const applyPlanIntent = useAppStore((state) => state.applyPlanIntent);
  const armRecalc = useRecalcStore((state) => state.arm);
  const weights = useBodyWeightSeries();

  const [objective, setObjective] = useState<PlanObjective>(goal?.objective ?? 'build');
  const [speed, setSpeed] = useState<PlanSpeed>(goal?.speed ?? 'steady');
  const [fatTolerance, setFatTolerance] = useState<FatTolerance>(goal?.fatTolerance ?? 'some');
  const [horizonWeeks, setHorizonWeeks] = useState(12);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(goal?.targetWeightKg ?? null);

  const latestWeight = weights[weights.length - 1]?.weightKg ?? null;

  const input: SimulationInput | null = useMemo(() => {
    if (!profile || latestWeight === null) return null;
    return {
      today: todayOf(),
      objective,
      speed,
      fatTolerance,
      currentWeightKg: latestWeight,
      heightCm: profile.heightCm,
      age: profile.age ?? 30,
      sex: profile.sex,
      experience: profile.experience,
      targetWeightKg,
      horizonWeeks,
      sessionsCompleted: engine.projection?.sessionsCompleted ?? 0,
      goalStartedAt: goal?.startedAt ?? todayOf(),
      observedWeeklyRateKg: engine.projectionInput?.observedWeeklyRateKg ?? null,
      weeksOfWeightData: engine.projectionInput?.weeksOfWeightData ?? 0,
      adherence: engine.adherenceRate,
    };
  }, [profile, latestWeight, objective, speed, fatTolerance, targetWeightKg, horizonWeeks, engine, goal]);

  const simulation = useMemo(() => (input ? simulatePlan(input) : null), [input]);
  const speedOptions = useMemo(() => (input ? compareSpeeds(input) : []), [input]);

  if (!profile || latestWeight === null || !simulation || !input) {
    return (
      <Screen>
        <Header title="Plan" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState
          title="Log your weight first"
          description="The plan is calculated from your own numbers, so it needs a starting weight."
          action={{ label: 'Log weight', onPress: () => router.push('/log-weight') }}
        />
      </Screen>
    );
  }

  const suggested = suggestTargetWeight({ ...input });
  const gaining = simulation.outcome.weightChangeKg > 0;
  const changed =
    objective !== goal?.objective || speed !== goal?.speed || fatTolerance !== goal?.fatTolerance;

  return (
    <Screen>
      <Header
        title="Plan"
        subtitle={simulation.strategyLabel}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {/* 1. What do you want. */}
      <Reveal index={0}>
        <Section title="What do you want">
          <SegmentedControl
            options={(Object.keys(OBJECTIVE_LABELS) as PlanObjective[]).map((value) => ({
              value,
              label: OBJECTIVE_LABELS[value],
            }))}
            value={objective}
            onChange={(value) => {
              Haptics.selectionAsync();
              setObjective(value);
            }}
            layout="wrap"
          />
        </Section>
      </Reveal>

      {/* 2. How fast. */}
      <Reveal index={1}>
        <Section title="How fast">
          <SegmentedControl
            options={SPEEDS.map((value) => ({ value, label: SPEED_LABELS[value] }))}
            value={speed}
            onChange={(value) => {
              Haptics.selectionAsync();
              setSpeed(value);
            }}
            layout="wrap"
          />
        </Section>
      </Reveal>

      {/* 3. Only asked when it changes anything. */}
      {objective !== 'lean' ? (
        <Reveal index={2}>
          <Section title="Fat you will accept">
            <SegmentedControl
              options={(Object.keys(FAT_TOLERANCE_LABELS) as FatTolerance[]).map((value) => ({
                value,
                label: FAT_TOLERANCE_LABELS[value],
              }))}
              value={fatTolerance}
              onChange={(value) => {
                Haptics.selectionAsync();
                setFatTolerance(value);
              }}
              layout="wrap"
            />
          </Section>
        </Reveal>
      ) : null}

      {/* The answer. */}
      <Reveal index={3}>
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <Label>{`In ${horizonWeeks} weeks`}</Label>
            <StatusPill
              label={
                simulation.feasibility === 'not_useful'
                  ? 'too fast to be useful'
                  : simulation.feasibility === 'demanding'
                    ? 'demanding'
                    : 'sustainable'
              }
              tone={
                simulation.feasibility === 'not_useful'
                  ? 'danger'
                  : simulation.feasibility === 'demanding'
                    ? 'warning'
                    : 'accent'
              }
            />
          </View>

          <View style={styles.heroValue}>
            <AnimatedNumber
              value={simulation.outcome.weightChangeKg}
              decimals={1}
              prefix={gaining ? '+' : ''}
              variant="display"
            />
            <Text variant="title" tone="tertiary">
              kg
            </Text>
          </View>

          <Text variant="body" tone="secondary" style={styles.heroLine}>
            {gaining
              ? `About ${Math.abs(simulation.outcome.leanChangeKg)} kg lean, ${Math.abs(simulation.outcome.fatChangeKg)} kg fat`
              : `About ${Math.abs(simulation.outcome.fatChangeKg)} kg fat, ${Math.abs(simulation.outcome.leanChangeKg)} kg lean`}
          </Text>

          {simulation.projection.targetDate ? (
            <View style={styles.heroTarget}>
              <Text variant="bodySmall" tone="tertiary">
                {`Target ${targetWeightKg?.toFixed(1) ?? suggested.toFixed(1)} kg reached around `}
                <Text variant="bodySmall">{formatLongDate(simulation.projection.targetDate)}</Text>
                {` · ${simulation.projection.daysRemaining} days`}
              </Text>
            </View>
          ) : null}

          <View style={styles.horizons}>
            {HORIZONS.map((weeks) => (
              <Text
                key={weeks}
                variant="caption"
                tone={weeks === horizonWeeks ? 'accent' : 'tertiary'}
                onPress={() => setHorizonWeeks(weeks)}
                style={styles.horizon}
              >
                {`${weeks} weeks`}
              </Text>
            ))}
          </View>
        </View>
      </Reveal>

      {/* What it takes. */}
      <Reveal index={4}>
        <Section title="What this needs from you">
          {simulation.requirements.map((requirement) => (
            <View key={requirement.key} style={styles.bullet}>
              <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              <Text variant="bodySmall" style={styles.bulletText}>
                {requirement.label}
              </Text>
            </View>
          ))}
        </Section>
      </Reveal>

      <Reveal index={5}>
        <Section title="What it costs">
          {simulation.tradeoffs.map((tradeoff) => (
            <View key={tradeoff.key} style={styles.bullet}>
              <View style={[styles.dot, { backgroundColor: colors.warning }]} />
              <Text variant="bodySmall" tone="secondary" style={styles.bulletText}>
                {tradeoff.label}
              </Text>
            </View>
          ))}
        </Section>
      </Reveal>

      {/* Every pace, side by side. */}
      <Reveal index={6}>
        <Section title="Every pace" footnote="Days to your target, and what each one asks for.">
          {speedOptions.map((option, index) => (
            <View key={option.speed}>
              {index > 0 ? <Divider /> : null}
              <MetricRow
                label={SPEED_LABELS[option.speed]}
                detail={`${option.result.daysPerWeek} sessions a week · ${option.result.macros.kcal} kcal`}
                value={
                  option.result.projection.daysRemaining === null
                    ? '—'
                    : `${option.result.projection.daysRemaining}d`
                }
                onPress={() => {
                  Haptics.selectionAsync();
                  setSpeed(option.speed);
                }}
              />
            </View>
          ))}
        </Section>
      </Reveal>

      {/* Macros. */}
      <Reveal index={7}>
        <Section title="Daily macros" footnote="Protein from body weight, fat at 25 % of intake, carbohydrate takes the rest.">
          <View style={styles.macros}>
            <Macro label="Calories" value={simulation.macros.kcal} unit="kcal" />
            <Macro label="Protein" value={simulation.macros.proteinG} unit="g" />
            <Macro label="Carbs" value={simulation.macros.carbsG} unit="g" />
            <Macro label="Fat" value={simulation.macros.fatG} unit="g" />
          </View>
        </Section>
      </Reveal>

      <Reveal index={8}>
        <Section title="Target weight" footnote="Leave it and the app uses the one this pace reaches.">
          <NumberInput
            value={targetWeightKg ?? suggested}
            onChange={setTargetWeightKg}
            suffix="kg"
            step={0.5}
            precision={1}
          />
        </Section>
      </Reveal>

      <PrimaryButton
        label={changed ? 'Use this plan' : 'Plan is up to date'}
        disabled={!changed && targetWeightKg === goal?.targetWeightKg}
        onPress={() => {
          // Capture the numbers as they stand, so the plan screen can count
          // from the old target to the new one instead of just showing it.
          armRecalc(snapshotOf(engine), 'Plan changed');
          applyPlanIntent({
            objective,
            speed,
            fatTolerance,
            targetWeightKg: targetWeightKg ?? suggested,
            horizonWeeks,
          });
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        }}
      />

      <MetricRow
        label="Not sure? Compare full plans"
        detail="Build then cut, lean build, cut first — drawn side by side"
        onPress={() => router.push('/routes')}
        chevron
      />

      <Note style={styles.note}>{PROJECTION_CAVEAT}</Note>
      <MetricRow label="How these numbers are built" onPress={() => router.push('/method')} chevron />
    </Screen>
  );
}

function Macro({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <View style={styles.macro}>
      <Label>{label}</Label>
      <View style={styles.macroValue}>
        <AnimatedNumber value={value} variant="metricSmall" />
        <Text variant="caption" tone="tertiary">
          {unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
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
    marginTop: spacing.md,
  },
  heroLine: {
    marginTop: spacing.xs,
  },
  heroTarget: {
    marginTop: spacing.lg,
  },
  horizons: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  horizon: {
    paddingVertical: spacing.xs,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
  },
  bulletText: {
    flex: 1,
  },
  macros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  macro: {
    width: '50%',
    gap: 2,
  },
  macroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  note: {
    marginTop: spacing.xl,
  },
});
