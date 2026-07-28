import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, ConfirmationSheet } from '@/components/BottomSheet';
import { PrimaryButton, TextButton } from '@/components/Button';
import { EmptyState, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import {
  BUILDER_STRATEGIES,
  MAX_BLOCKS,
  MAX_TOTAL_WEEKS,
  clampBlockWeeks,
  defaultCustomBlocks,
  planIsSavable,
  reviewPlan,
  toRoute,
  totalWeeks,
  type CustomBlock,
} from '@/domain/plan/customPlan';
import { simulateRoute, type RouteInput } from '@/domain/plan/routes';
import { strategyProfile } from '@/domain/plan/strategies';
import type { NutritionStrategy } from '@/domain/types';
import { BlockBar, toneFor } from '@/features/plan/BlockBar';
import { RouteChart } from '@/features/plan/RouteChart';
import { useBodyWeightSeries, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { snapshotOf, useRecalcStore } from '@/store/useRecalcStore';
import { createId } from '@/utils/id';
import { formatLongDate, today as todayOf } from '@/utils/date';

/**
 * Build the plan yourself.
 *
 * Drag a block and the curve, the end weight, the composition split and every
 * date redraw underneath as it moves. Nothing here is a form: the only inputs
 * are how long each block runs and what kind of block it is.
 *
 * Where you cannot go is drawn rather than explained — the dead zones at each
 * end of a bar are the block's own limits — and what the body will not do is
 * left to the simulation, which caps muscle gain at what training can build
 * and shows the rest arriving as fat.
 */
export default function BuilderScreen() {
  const router = useRouter();
  const engine = useEngine();
  const profile = useAppStore((state) => state.profile);
  const planRoute = useAppStore((state) => state.planRoute);
  const applyCustomPlan = useAppStore((state) => state.applyCustomPlan);
  const arm = useRecalcStore((state) => state.arm);
  const weights = useBodyWeightSeries();

  const [blocks, setBlocks] = useState<CustomBlock[]>(
    () => (planRoute?.blocks?.length ? planRoute.blocks.map((block) => ({
      id: createId(),
      strategy: block.strategy,
      weeks: block.weeks,
    })) : defaultCustomBlocks()),
  );
  const [picking, setPicking] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const latest = weights[weights.length - 1] ?? null;

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
      sessionsPerWeek: engine.weeklyTarget,
    };
  }, [profile, latest, engine.weeklyTarget]);

  // Recomputed on every drag frame — this is the live part.
  const simulation = useMemo(
    () => (input && blocks.length > 0 ? simulateRoute(input, toRoute(blocks)) : null),
    [input, blocks],
  );
  const notes = useMemo(() => reviewPlan(blocks, simulation), [blocks, simulation]);
  const savable = planIsSavable(notes);
  const weeks = totalWeeks(blocks);

  const setWeeks = (id: string, next: number) => {
    setBlocks((current) =>
      current.map((block) =>
        block.id === id
          ? {
              ...block,
              weeks: clampBlockWeeks(
                block.strategy,
                next,
                current.filter((entry) => entry.id !== id).reduce((total, entry) => total + entry.weeks, 0),
              ),
            }
          : block,
      ),
    );
  };

  const setStrategy = (id: string, strategy: NutritionStrategy) => {
    Haptics.selectionAsync();
    setBlocks((current) =>
      current.map((block) =>
        block.id === id ? { ...block, strategy, weeks: clampBlockWeeks(strategy, block.weeks) } : block,
      ),
    );
    setPicking(null);
  };

  const addBlock = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Follow a gaining block with a losing one, and the other way round.
    const last = blocks[blocks.length - 1];
    const next: NutritionStrategy =
      last && strategyProfile(last.strategy).energyBalancePct >= 0 ? 'cut' : 'lean_bulk';
    setBlocks((current) => [...current, { id: createId(), strategy: next, weeks: clampBlockWeeks(next, 8) }]);
  };

  const save = () => {
    arm(snapshotOf(engine), 'Your plan');
    applyCustomPlan(blocks);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  if (!input) {
    return (
      <Screen>
        <Header title="Build a plan" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState
          title="Log your weight first"
          description="A plan is drawn from where you are now."
          action={{ label: 'Log weight', onPress: () => router.push('/log-weight') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Build a plan"
        subtitle={simulation ? `${weeks} weeks · ends ${formatLongDate(simulation.endDate)}` : `${weeks} weeks`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {simulation ? (
        <Reveal index={0}>
          <RouteChart simulation={simulation} height={190} />
        </Reveal>
      ) : null}

      {/* The numbers that move while you drag. */}
      {simulation ? (
        <Reveal index={1}>
          <View style={styles.readout}>
            <View style={styles.metric}>
              <Label>Weight</Label>
              <View style={styles.metricValue}>
                <AnimatedNumber value={simulation.endWeightKg} decimals={1} variant="title" />
                <Text variant="bodySmall" tone="tertiary">
                  kg
                </Text>
              </View>
            </View>
            <View style={styles.metric}>
              <Label>Muscle</Label>
              <View style={styles.metricValue}>
                <AnimatedNumber
                  value={simulation.muscleGainKg}
                  decimals={1}
                  prefix={simulation.muscleGainKg > 0 ? '+' : ''}
                  variant="title"
                  style={{ color: colors.accent }}
                />
                <Text variant="bodySmall" tone="tertiary">
                  kg
                </Text>
              </View>
            </View>
            <View style={styles.metric}>
              <Label>Fat</Label>
              <View style={styles.metricValue}>
                <AnimatedNumber
                  value={simulation.fatChangeKg}
                  decimals={1}
                  prefix={simulation.fatChangeKg > 0 ? '+' : ''}
                  variant="title"
                  style={{ color: simulation.fatChangeKg > 0 ? colors.warning : colors.info }}
                />
                <Text variant="bodySmall" tone="tertiary">
                  kg
                </Text>
              </View>
            </View>
          </View>
        </Reveal>
      ) : null}

      <Reveal index={2}>
        <Section
          title="Blocks"
          footnote={`${weeks} of ${MAX_TOTAL_WEEKS} weeks used`}
          action={
            blocks.length < MAX_BLOCKS && weeks < MAX_TOTAL_WEEKS
              ? { label: 'Add block', onPress: addBlock }
              : undefined
          }
        >
          {blocks.map((block) => (
            <BlockBar
              key={block.id}
              block={block}
              weeksElsewhere={weeks - block.weeks}
              onChange={(next) => setWeeks(block.id, next)}
              onPressLabel={() => setPicking(block.id)}
              onRemove={blocks.length > 1 ? () => setBlocks((c) => c.filter((e) => e.id !== block.id)) : undefined}
            />
          ))}
        </Section>
      </Reveal>

      {notes.length > 0 ? (
        <Reveal index={3}>
          <Section title="What this means">
            {notes.map((note) => (
              <View key={note.id} style={styles.note}>
                <StatusPill
                  label={note.severity === 'blocked' ? 'Not possible' : note.severity === 'warning' ? 'Cost' : 'Note'}
                  tone={note.severity === 'blocked' ? 'warning' : note.severity === 'warning' ? 'warning' : 'neutral'}
                />
                <Text variant="bodySmall" tone="secondary" style={styles.noteText}>
                  {note.message}
                </Text>
              </View>
            ))}
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={4}>
        <PrimaryButton
          label={savable ? 'Follow this plan' : 'Fix the blocks above'}
          disabled={!savable}
          onPress={() => setConfirm(true)}
          style={styles.cta}
        />
        <TextButton label="Use a named plan instead" onPress={() => router.replace('/routes')} style={styles.alt} />
      </Reveal>

      <BottomSheet visible={picking !== null} onClose={() => setPicking(null)} title="What kind of block">
        {BUILDER_STRATEGIES.map((strategy) => {
          const strategyInfo = strategyProfile(strategy);
          return (
            <Pressable
              key={strategy}
              onPress={() => picking && setStrategy(picking, strategy)}
              style={({ pressed }) => [styles.option, pressed && { opacity: opacity.pressed }]}
            >
              <View style={[styles.swatch, { backgroundColor: toneFor(strategy) }]} />
              <View style={styles.optionText}>
                <Text variant="body">{strategyInfo.label}</Text>
                <Text variant="caption" tone="tertiary">
                  {strategyInfo.tradeoff}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </BottomSheet>

      <ConfirmationSheet
        visible={confirm}
        onClose={() => setConfirm(false)}
        title="Follow your plan"
        message={
          simulation
            ? `${blocks.length} blocks over ${weeks} weeks, ending ${formatLongDate(simulation.endDate)} at about ${simulation.endWeightKg.toFixed(1)} kg. Everything you have already logged carries over.`
            : ''
        }
        confirmLabel="Start it"
        onConfirm={save}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  metric: {
    gap: spacing.sm,
  },
  metricValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  noteText: {
    flex: 1,
  },
  cta: {
    marginTop: spacing.xl,
  },
  alt: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
});
