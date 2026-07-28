import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmationSheet } from '@/components/BottomSheet';
import { PrimaryButton } from '@/components/Button';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Metric, MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { PROJECTION_CAVEAT } from '@/data/trainingPrinciples';
import { getRoute, simulateRoute, type RouteInput } from '@/domain/plan/routes';
import { RouteChart } from '@/features/plan/RouteChart';
import { useBodyWeightSeries, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { snapshotOf, useRecalcStore } from '@/store/useRecalcStore';
import { formatLongDate, today as todayOf } from '@/utils/date';

/** One route in full: the curve, every block, and what each block asks for. */
export default function RouteDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAppStore((state) => state.profile);
  const training = useAppStore((state) => state.training);
  const planRoute = useAppStore((state) => state.planRoute);
  const applyRoute = useAppStore((state) => state.applyRoute);
  const armRecalc = useRecalcStore((state) => state.arm);
  const engine = useEngine();
  const weights = useBodyWeightSeries();

  const [confirm, setConfirm] = useState(false);

  const latest = weights[weights.length - 1] ?? null;
  const route = getRoute(id);

  const input: RouteInput | null = useMemo(() => {
    if (!profile || !latest) return null;
    return {
      today: todayOf(),
      currentWeightKg: latest.weightKg,
      heightCm: profile.heightCm,
      age: profile.age ?? 30,
      sex: profile.sex,
      experience: profile.experience,
      bodyFatPercent: latest.bodyFatPercent,
      sessionsPerWeek: training.preferredDaysPerWeek,
    };
  }, [profile, latest, training.preferredDaysPerWeek]);

  const simulation = useMemo(
    () => (input && route ? simulateRoute(input, route) : null),
    [input, route],
  );

  if (!route || !simulation) {
    return (
      <Screen>
        <Header title="Plan" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState title="Plan not found" description="Pick one from the list of routes." />
      </Screen>
    );
  }

  const active = planRoute?.routeId === route.id;

  return (
    <Screen>
      <Header
        title={route.name}
        subtitle={`${simulation.totalWeeks} weeks · ends ${formatLongDate(simulation.endDate)}`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
        trailing={active ? <StatusPill label="Current" tone="accent" /> : undefined}
      />

      <Reveal index={0}>
        <Section>
          <RouteChart
            simulation={simulation}
            height={180}
            showBodyFat={latest?.bodyFatPercent !== null}
          />
        </Section>
      </Reveal>

      <Reveal index={1}>
        <Section title="Where it ends">
          <View style={styles.metrics}>
            <Metric label="Weight" value={`${simulation.endWeightKg}`} unit="kg" />
            <Metric label="Muscle" value={`+${simulation.muscleGainKg}`} unit="kg" size="small" />
            <Metric
              label="Fat"
              value={`${simulation.fatChangeKg > 0 ? '+' : ''}${simulation.fatChangeKg}`}
              unit="kg"
              size="small"
              intent="negative"
              trend={simulation.fatChangeKg > 0 ? 'up' : 'down'}
            />
          </View>
          {simulation.endBodyFatPercent !== null ? (
            <Text variant="bodySmall" tone="secondary" style={styles.bodyFat}>
              {`Body fat ends around ${simulation.endBodyFatPercent} %`}
              {simulation.peakBodyFatPercent !== null &&
              simulation.peakBodyFatPercent > simulation.endBodyFatPercent
                ? `, peaking near ${simulation.peakBodyFatPercent} % on the way`
                : ''}
            </Text>
          ) : null}
        </Section>
      </Reveal>

      <Reveal index={2}>
        <Section title="The blocks" footnote={route.bestFor}>
          {simulation.blocks.map((block, index) => (
            <View key={block.index}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.block}>
                <View style={styles.blockHead}>
                  <Text variant="heading">{`${index + 1}. ${block.label}`}</Text>
                  <Text variant="bodySmall" tone="secondary" mono>
                    {`${block.weightChangeKg > 0 ? '+' : ''}${block.weightChangeKg} kg`}
                  </Text>
                </View>
                <Text variant="bodySmall" tone="secondary">
                  {`${block.weeks} weeks · ${block.strategyLabel.toLowerCase()}`}
                </Text>
                <View style={styles.blockMeta}>
                  <Label>{`${block.kcal} kcal`}</Label>
                  <Label>{`${block.proteinG} g protein`}</Label>
                  <Label>{`until ${formatLongDate(block.endDate)}`}</Label>
                </View>
              </View>
            </View>
          ))}
        </Section>
      </Reveal>

      <Reveal index={3}>
        <Section title="Milestones">
          {simulation.blocks.map((block) => (
            <View key={`milestone-${block.index}`}>
              <MetricRow
                label={`${block.label} done`}
                detail={formatLongDate(block.endDate)}
                value={`${simulation.points[block.endWeek]?.weightKg ?? simulation.endWeightKg} kg`}
              />
              <Divider />
            </View>
          ))}
          <MetricRow
            label="Plan complete"
            detail={formatLongDate(simulation.endDate)}
            value={`${simulation.endWeightKg} kg`}
          />
        </Section>
      </Reveal>

      <PrimaryButton
        label={active ? 'Already following this' : 'Follow this plan'}
        disabled={active}
        onPress={() => setConfirm(true)}
      />

      <Note style={styles.note}>{PROJECTION_CAVEAT}</Note>

      <ConfirmationSheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title={`Follow ${route.name}`}
        message={`The first block is ${simulation.blocks[0].label.toLowerCase()} for ${simulation.blocks[0].weeks} weeks at ${simulation.blocks[0].kcal} kcal. Your training days change to match it, and everything you have already logged carries over.`}
        confirmLabel="Start this plan"
        onConfirm={() => {
          armRecalc(snapshotOf(engine), `Started ${route.name}`);
          applyRoute(route.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  bodyFat: {
    marginTop: spacing.lg,
  },
  block: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  note: {
    marginTop: spacing.xl,
  },
});
