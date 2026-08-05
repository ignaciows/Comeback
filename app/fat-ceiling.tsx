import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { analyseComposition } from '@/domain/body/composition';
import { compareAgainstCeiling } from '@/domain/plan/ceilingComparison';
import { CEILING_ROUTE_ID, planToCeiling, weeksOfHeadroom } from '@/domain/plan/fatCeiling';
import type { RouteInput } from '@/domain/plan/routes';
import { RouteChart } from '@/features/plan/RouteChart';
import { useAppStore } from '@/store/useAppStore';
import { today as todayOf } from '@/utils/date';

/**
 * "How far up are you willing to go?" — the first question, not a setting.
 *
 * The plan pickers all ask some version of "build or cut", which is the wrong
 * question because it is downstream of this one. Someone at 18.7 % who will
 * not pass 17 % has already answered "build or cut" without knowing it: there
 * is no room to build, so the plan cuts, and the module can work that out
 * without making them guess. Asking for the ceiling first means the app
 * derives the direction instead of asking the user to.
 *
 * The screen shows three things in the order they earn attention: what the
 * limit implies, why it implies that, and what it costs against the plans that
 * ignore it. The last one exists because a promise with nothing to weigh it
 * against gets accepted blindly or not at all.
 */
export default function FatCeilingScreen() {
  const router = useRouter();
  const goal = useAppStore((state) => state.goal);
  const profile = useAppStore((state) => state.profile);
  const measurements = useAppStore((state) => state.bodyMeasurements);
  const training = useAppStore((state) => state.training);
  const planRoute = useAppStore((state) => state.planRoute);
  const updateGoal = useAppStore((state) => state.updateGoal);
  const applyCustomPlan = useAppStore((state) => state.applyCustomPlan);

  const latest = [...measurements].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1) ?? null;
  const weightKg = latest?.weightKg ?? 80;

  const composition =
    profile && latest
      ? analyseComposition({
          heightCm: profile.heightCm,
          weightKg,
          sex: profile.sex,
          bodyFatPercent: latest.bodyFatPercent,
          wristCm: profile.wristCm,
          experience: profile.experience,
        })
      : null;

  const currentFat = composition?.bodyFatPercent ?? 18;
  const experience = profile?.experience ?? 'intermediate';
  const horizonWeeks = goal?.horizonWeeks ?? 32;
  const [ceiling, setCeiling] = useState<number | null>(goal?.maxBodyFatPercent ?? null);

  const ceilingArgs = useMemo(
    () =>
      ceiling === null
        ? null
        : {
            weightKg,
            bodyFatPercent: currentFat,
            ceilingPercent: ceiling,
            buildStrategy: 'lean_bulk' as const,
            cutStrategy: 'cut' as const,
            experience,
            horizonWeeks,
          },
    [ceiling, weightKg, currentFat, experience, horizonWeeks],
  );

  const preview = useMemo(() => (ceilingArgs ? planToCeiling(ceilingArgs) : null), [ceilingArgs]);
  const headroom = useMemo(
    () => (ceilingArgs ? weeksOfHeadroom(ceilingArgs) : null),
    [ceilingArgs],
  );

  /**
   * The comparison needs a real body-fat reading, not the 18 % placeholder the
   * preview falls back on — every number in it is a body-fat number, and one
   * built on a guess would be confidently wrong.
   */
  const comparison = useMemo(() => {
    if (ceiling === null || !profile || !latest || latest.bodyFatPercent === null) return null;
    const input: RouteInput = {
      today: todayOf(),
      currentWeightKg: weightKg,
      heightCm: profile.heightCm,
      age: profile.age ?? 30,
      sex: profile.sex,
      experience: profile.experience,
      bodyFatPercent: latest.bodyFatPercent,
      sessionsPerWeek: training.preferredDaysPerWeek,
    };
    return compareAgainstCeiling(input, ceiling, { horizonWeeks });
  }, [ceiling, profile, latest, weightKg, training.preferredDaysPerWeek, horizonWeeks]);

  const already = planRoute?.routeId === CEILING_ROUTE_ID;

  const usePlan = () => {
    if (!preview || preview.blocks.length === 0 || ceiling === null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateGoal({ maxBodyFatPercent: ceiling });
    applyCustomPlan(
      preview.blocks.map((block, index) => ({
        id: `ceiling-${index}`,
        strategy: block.strategy,
        weeks: block.weeks,
      })),
      {
        routeId: CEILING_ROUTE_ID,
        name: `Never past ${ceiling} %`,
        reason: `Switched to a plan capped at ${ceiling} % body fat`,
      },
    );
    router.back();
  };

  const saveLimitOnly = () => {
    Haptics.selectionAsync();
    updateGoal({ maxBodyFatPercent: ceiling });
    router.back();
  };

  const options = [12, 15, 17, 20, 25];

  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title="How high will you let it go?"
        subtitle={`Around ${currentFat.toFixed(1)} % body fat now`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <Note>
          Pick the number you will not pass and the plan works out the rest — whether it builds or
          cuts first, and for how long. You do not have to decide that part.
        </Note>
      </Reveal>

      <Reveal index={1}>
        <Section title="Never go above">
          <View style={styles.options}>
            {options.map((value) => {
              const selected = ceiling === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCeiling(value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionOn,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <Text variant="title" mono style={selected ? styles.optionTextOn : undefined}>
                    {value}
                  </Text>
                  <Text variant="caption" tone={selected ? 'primary' : 'tertiary'}>
                    %
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <TextButton
            label={ceiling === null ? 'No limit (selected)' : 'Remove the limit'}
            onPress={() => setCeiling(null)}
            style={styles.none}
          />
        </Section>
      </Reveal>

      {/*
        Why this plan, before what the plan is. Someone who came in wanting to
        build and is being told to cut will not read past the first block
        otherwise — and the reason is arithmetic they can check, not advice.
      */}
      {preview?.rationale ? (
        <Reveal index={2}>
          <View style={styles.rationale}>
            <View style={styles.rationaleHead}>
              <Icon name="info" size={14} color={colors.accent} />
              <Text variant="heading">{preview.rationale.headline}</Text>
            </View>
            <Text variant="body" tone="secondary" style={styles.rationaleText}>
              {preview.rationale.detail}
            </Text>
          </View>
        </Reveal>
      ) : null}

      {preview && ceiling !== null ? (
        <Reveal index={3}>
          <Section title="What that gives you">
            {headroom !== null && headroom > 0 ? (
              <View style={styles.headroom}>
                <AnimatedNumber value={headroom} variant="display" />
                <Text variant="body" tone="secondary">
                  {headroom === 1
                    ? 'week of building before you have to stop'
                    : 'weeks of building before you have to stop'}
                </Text>
              </View>
            ) : null}

            {preview.warning ? (
              <View style={styles.warning}>
                <Icon name="info" size={14} color={colors.warning} />
                <Text variant="body" style={styles.warningText}>
                  {preview.warning}
                </Text>
              </View>
            ) : null}

            {preview.blocks.map((block, index) => (
              <View key={`${block.label}-${index}`} style={styles.block}>
                <View style={[styles.dot, block.kind === 'build' ? styles.dotBuild : styles.dotCut]} />
                <View style={styles.blockText}>
                  <Text variant="body">{`${block.label} · ${block.weeks} weeks`}</Text>
                  <Text variant="caption" tone="tertiary">
                    {`${block.startFatPercent} % → ${block.endFatPercent} % · ${block.startWeightKg} → ${block.endWeightKg} kg`}
                  </Text>
                </View>
              </View>
            ))}

            {preview.blocks.length > 0 ? (
              <Text variant="caption" tone="tertiary" style={styles.floor}>
                {`Cuts bring you back to ${preview.floorPercent} % before the next build starts.`}
              </Text>
            ) : null}
          </Section>
        </Reveal>
      ) : null}

      {/*
        The trade, against the plans that ignore the limit. Without this the
        ceiling is a promise with nothing to weigh it against, and the honest
        objection — "I would have gained more without it" — goes unanswered.
      */}
      {comparison ? (
        <Reveal index={4}>
          <Section
            title="Against the other routes"
            action={{ label: 'See them all', onPress: () => router.push('/routes') }}
          >
            <RouteChart
              simulation={comparison.simulation}
              height={100}
              showBodyFat
              style={styles.chart}
            />

            <View style={styles.compareRow}>
              <View style={styles.compareName}>
                <View style={[styles.dot, styles.dotBuild]} />
                <Text variant="body">{comparison.ours.name}</Text>
              </View>
              <Text variant="bodySmall" mono style={styles.underLine}>
                {`peaks ${comparison.ours.peakBodyFatPercent} %`}
              </Text>
            </View>

            {comparison.others.map((other) => (
              <View key={other.routeId} style={styles.compareRow}>
                <View style={styles.compareName}>
                  <View style={[styles.dot, other.crosses ? styles.dotOver : styles.dotCut]} />
                  <Text variant="body" tone="secondary">
                    {other.name}
                  </Text>
                </View>
                <Text
                  variant="bodySmall"
                  mono
                  style={other.crosses ? styles.overLine : undefined}
                  tone={other.crosses ? 'primary' : 'tertiary'}
                >
                  {other.crosses
                    ? `peaks ${other.peakBodyFatPercent} % · +${other.overshoot}`
                    : `peaks ${other.peakBodyFatPercent} %`}
                </Text>
              </View>
            ))}

            {comparison.trade ? (
              <Text variant="bodySmall" tone="secondary" style={styles.trade}>
                {comparison.trade}
              </Text>
            ) : (
              <Text variant="bodySmall" tone="tertiary" style={styles.trade}>
                {`Nothing on the menu crosses ${comparison.ceiling} % from where you are, so the limit costs you nothing today.`}
              </Text>
            )}

            <Label style={styles.muscle}>
              {`This plan: +${comparison.ours.muscleGainKg} kg muscle over ${comparison.ours.weeks} weeks`}
            </Label>
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={5}>
        <View style={styles.actions}>
          {preview && preview.blocks.length > 0 ? (
            <PrimaryButton
              label={already ? 'Rebuild this plan' : 'Use this as my plan'}
              onPress={usePlan}
            />
          ) : null}
          <TextButton
            label={ceiling === null ? 'Save with no limit' : 'Just save the limit'}
            onPress={saveLimitOnly}
            style={styles.secondary}
          />
        </View>
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  optionOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  optionTextOn: {
    color: colors.accent,
  },
  none: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  rationale: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.accentSurface,
  },
  rationaleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rationaleText: {
    marginTop: spacing.sm,
  },
  headroom: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  warningText: {
    flex: 1,
  },
  block: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  dotBuild: {
    backgroundColor: colors.accent,
  },
  dotCut: {
    backgroundColor: colors.textTertiary,
  },
  dotOver: {
    backgroundColor: colors.warning,
  },
  blockText: {
    flex: 1,
    gap: spacing.xs,
  },
  floor: {
    marginTop: spacing.md,
  },
  chart: {
    marginBottom: spacing.lg,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  compareName: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  underLine: {
    color: colors.accent,
  },
  overLine: {
    color: colors.warning,
  },
  trade: {
    marginTop: spacing.lg,
  },
  muscle: {
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  secondary: {
    alignSelf: 'center',
  },
});
