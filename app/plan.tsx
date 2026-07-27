import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ConfirmationSheet } from '@/components/BottomSheet';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { NumberInput } from '@/components/Input';
import { Metric, MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { PROJECTION_CAVEAT } from '@/data/trainingPrinciples';
import { compareStrategies } from '@/domain/plan/projection';
import { STRATEGIES, STRATEGY_ORDER } from '@/domain/plan/strategies';
import type { NutritionStrategy } from '@/domain/types';
import { MilestoneTrack } from '@/features/plan/MilestoneTrack';
import { useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatLongDate, formatShortDate } from '@/utils/date';

/**
 * Change the plan, at any moment, and see exactly what it costs or saves before
 * committing. Everything already logged carries over — switching strategy does
 * not restart anything.
 */
export default function PlanScreen() {
  const router = useRouter();
  const engine = useEngine();
  const goal = useAppStore((state) => state.goal);
  const phases = useAppStore((state) => state.phases);
  const changeStrategy = useAppStore((state) => state.changeStrategy);
  const updateGoal = useAppStore((state) => state.updateGoal);

  const [pending, setPending] = useState<NutritionStrategy | null>(null);
  const [targetWeight, setTargetWeight] = useState<number | null>(goal?.targetWeightKg ?? null);

  const comparisons = useMemo(
    () =>
      engine.projectionInput
        ? compareStrategies(engine.projectionInput, STRATEGY_ORDER)
        : [],
    [engine.projectionInput],
  );

  const current = engine.projection;

  if (!goal || !current) {
    return (
      <Screen>
        <Header title="Plan" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState
          title="No plan yet"
          description="Log your body weight and finish onboarding, and the plan projections start from your own numbers."
          action={{ label: 'Log weight', onPress: () => router.push('/log-weight') }}
        />
      </Screen>
    );
  }

  const currentProfile = STRATEGIES[goal.strategy];
  const pendingComparison = comparisons.find((entry) => entry.strategy === pending);

  return (
    <Screen>
      <Header
        title="Plan"
        subtitle={currentProfile.label}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
        trailing={<StatusPill label={`${current.confidence} confidence`} tone="neutral" />}
      />

      <Reveal index={0}>
        <Section>
          <MilestoneTrack
            completed={current.sessionsCompleted}
            remaining={current.sessionsRemaining}
            targetLabel={goal.targetWeightKg ? `${goal.targetWeightKg.toFixed(1)} kg` : 'no target set'}
            footnote={current.targetDate ? `Estimated ${formatLongDate(current.targetDate)}` : undefined}
          />
        </Section>
      </Reveal>

      <Reveal index={1}>
        <Section title="Where this leads" footnote={current.explanation}>
          <View style={styles.metrics}>
            <Metric
              label="Days left"
              value={current.daysRemaining === null ? '—' : `${current.daysRemaining}`}
              caption={current.targetDate ? formatLongDate(current.targetDate) : 'No target weight'}
            />
            <Metric
              label="Weekly rate"
              value={`${current.weeklyRateKg > 0 ? '+' : ''}${current.weeklyRateKg.toFixed(2)}`}
              unit="kg"
              size="small"
              intent="neutral"
            />
          </View>
        </Section>
      </Reveal>

      {current.milestones.length > 0 ? (
        <Reveal index={2}>
          <Section title="Milestones" footnote="Estimated dates at the current rate. They move as you log data.">
            {current.milestones.map((milestone, index) => (
              <View key={milestone.key}>
                {index > 0 ? <Divider /> : null}
                <MetricRow
                  label={milestone.label}
                  detail={`${formatShortDate(milestone.date)} · in ${milestone.inDays} days`}
                  value={`${milestone.weightKg.toFixed(1)} kg`}
                />
              </View>
            ))}
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={3}>
        <Section
          title="Estimated composition"
          footnote="Split of the projected weight change, from the strategy's typical ratio."
        >
          <MetricRow
            label="Lean mass"
            value={current.leanChangeKg === null ? '—' : `${current.leanChangeKg > 0 ? '+' : ''}${current.leanChangeKg} kg`}
          />
          <Divider />
          <MetricRow
            label="Fat mass"
            value={current.fatChangeKg === null ? '—' : `${current.fatChangeKg > 0 ? '+' : ''}${current.fatChangeKg} kg`}
          />
          <Divider />
          <MetricRow
            label="Muscle your training can add"
            detail="Ceiling set by training age, independent of the scale"
            value={current.muscleCeilingKg === null ? '—' : `${current.muscleCeilingKg} kg`}
          />
        </Section>
      </Reveal>

      <Reveal index={4}>
        <Section title="Daily targets" footnote="Calories are an estimate from height, weight and training frequency.">
          <MetricRow label="Maintenance" value={`${current.maintenanceKcal} kcal`} />
          <Divider />
          <MetricRow
            label="Target intake"
            detail={`${Math.round(currentProfile.energyBalancePct * 100)}% of maintenance`}
            value={`${current.targetKcal} kcal`}
          />
          <Divider />
          <MetricRow
            label="Protein"
            value={`${current.proteinTargetG[0]}–${current.proteinTargetG[1]} g`}
          />
        </Section>
      </Reveal>

      <Reveal index={5}>
        <Section title="Target weight">
          <NumberInput
            value={targetWeight}
            onChange={(value) => {
              setTargetWeight(value);
              updateGoal({ targetWeightKg: value });
            }}
            suffix="kg"
            step={0.5}
            precision={1}
            hint="Everything above recalculates from this."
          />
        </Section>
      </Reveal>

      <Reveal index={6}>
        <Section
          title="Change strategy"
          footnote="Progress you have already made carries over. Switching never resets your history."
        >
          {comparisons.map((entry) => {
            const profile = STRATEGIES[entry.strategy];
            const active = entry.strategy === goal.strategy;
            return (
              <Pressable
                key={entry.strategy}
                onPress={() => {
                  if (active) return;
                  Haptics.selectionAsync();
                  setPending(entry.strategy);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.option,
                  active && styles.optionActive,
                  pressed && { opacity: opacity.pressed },
                ]}
              >
                <View style={styles.optionHead}>
                  <Text variant="heading">{profile.label}</Text>
                  {active ? (
                    <StatusPill label="Current" tone="accent" />
                  ) : entry.deltaDays === null ? (
                    <Text variant="caption" tone="tertiary">
                      No date
                    </Text>
                  ) : (
                    <Text
                      variant="caption"
                      mono
                      style={{ color: entry.deltaDays <= 0 ? colors.accent : colors.warning }}
                    >
                      {`${entry.deltaDays > 0 ? '+' : ''}${entry.deltaDays}d`}
                    </Text>
                  )}
                </View>
                <Text variant="bodySmall" tone="secondary" style={styles.optionSummary}>
                  {profile.summary}
                </Text>
                <View style={styles.optionMeta}>
                  <Text variant="caption" tone="tertiary">
                    {entry.projection.targetDate
                      ? `Target ${formatShortDate(entry.projection.targetDate)}`
                      : 'Does not reach your target'}
                  </Text>
                  <Text variant="caption" tone="tertiary">
                    {`${entry.projection.targetKcal} kcal`}
                  </Text>
                </View>
                <Text variant="caption" tone="tertiary" style={styles.tradeoff}>
                  {profile.tradeoff}
                </Text>
              </Pressable>
            );
          })}
        </Section>
      </Reveal>

      {phases.length > 0 ? (
        <Reveal index={7}>
          <Section title="History">
            {[...phases].reverse().map((phase, index) => (
              <View key={phase.id}>
                {index > 0 ? <Divider /> : null}
                <MetricRow
                  label={STRATEGIES[phase.strategy].label}
                  detail={`${formatShortDate(phase.startedAt)} → ${phase.endedAt ? formatShortDate(phase.endedAt) : 'now'}`}
                  value={
                    phase.endWeightKg !== null && phase.startWeightKg > 0
                      ? `${phase.endWeightKg - phase.startWeightKg > 0 ? '+' : ''}${(phase.endWeightKg - phase.startWeightKg).toFixed(1)} kg`
                      : ''
                  }
                />
              </View>
            ))}
          </Section>
        </Reveal>
      ) : null}

      <Note>{PROJECTION_CAVEAT}</Note>
      <MetricRow label="How these numbers are built" onPress={() => router.push('/method')} chevron />

      <ConfirmationSheet
        visible={pending !== null}
        onClose={() => setPending(null)}
        title={pending ? `Switch to ${STRATEGIES[pending].label}` : ''}
        message={
          pendingComparison
            ? `${STRATEGIES[pendingComparison.strategy].tradeoff}\n\n${
                pendingComparison.projection.targetDate
                  ? `New estimated target: ${formatLongDate(pendingComparison.projection.targetDate)}${
                      pendingComparison.deltaDays === null
                        ? ''
                        : ` (${pendingComparison.deltaDays > 0 ? '+' : ''}${pendingComparison.deltaDays} days)`
                    }. Your ${current.sessionsCompleted} logged sessions carry over.`
                  : 'This strategy does not move you towards your current target weight.'
              }`
            : ''
        }
        confirmLabel="Switch"
        onConfirm={() => {
          if (!pending) return;
          changeStrategy(pending);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.xxl,
  },
  option: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  optionActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  optionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSummary: {
    marginTop: spacing.xs,
  },
  optionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  tradeoff: {
    marginTop: spacing.sm,
  },
});
