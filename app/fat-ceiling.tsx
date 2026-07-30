import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
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
import { planToCeiling, weeksOfHeadroom } from '@/domain/plan/fatCeiling';
import { analyseComposition } from '@/domain/body/composition';
import { useAppStore } from '@/store/useAppStore';

/**
 * The limit the plan is not allowed to cross.
 *
 * "Build as fast as possible, but never past seventeen percent" is the shape
 * of what people actually want, and no plan picker asks for it. Without the
 * limit the plan runs until the horizon and someone quietly stops using it
 * when they do not like the mirror — which is not a motivation problem, it is
 * a plan that was never told about the one thing that mattered.
 *
 * Setting it changes where phases end, so the screen shows that consequence
 * live: how many weeks of building this buys, and where the cut lands.
 */
export default function FatCeilingScreen() {
  const router = useRouter();
  const goal = useAppStore((state) => state.goal);
  const profile = useAppStore((state) => state.profile);
  const measurements = useAppStore((state) => state.bodyMeasurements);
  const updateGoal = useAppStore((state) => state.updateGoal);

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
  const [ceiling, setCeiling] = useState<number | null>(goal?.maxBodyFatPercent ?? null);

  const preview =
    ceiling === null
      ? null
      : planToCeiling({
          weightKg,
          bodyFatPercent: currentFat,
          ceilingPercent: ceiling,
          buildStrategy: 'lean_bulk',
          cutStrategy: 'cut',
          horizonWeeks: goal?.horizonWeeks ?? 24,
        });

  const headroom =
    ceiling === null
      ? null
      : weeksOfHeadroom({
          weightKg,
          bodyFatPercent: currentFat,
          ceilingPercent: ceiling,
          buildStrategy: 'lean_bulk',
          cutStrategy: 'cut',
        });

  const save = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateGoal({ maxBodyFatPercent: ceiling });
    router.back();
  };

  const options = [12, 15, 17, 20, 25];

  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title="Your fat limit"
        subtitle={`You are around ${currentFat.toFixed(0)} % now`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <Note>
          A limit the plan may not cross. Building phases end when the projection would take you past
          it, and a cut brings you back down before the next one starts.
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

      {/* The consequence, live. A limit with no visible effect is a setting. */}
      {preview && ceiling !== null ? (
        <Reveal index={2}>
          <Section title="What that gives you">
            {headroom !== null && headroom > 0 ? (
              <View style={styles.headroom}>
                <AnimatedNumber value={headroom} variant="display" />
                <Text variant="body" tone="secondary">
                  {headroom === 1 ? 'week of building before you have to stop' : 'weeks of building before you have to stop'}
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

      <Reveal index={3}>
        <PrimaryButton label="Use this limit" onPress={save} style={styles.cta} />
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
  blockText: {
    flex: 1,
    gap: spacing.xs,
  },
  floor: {
    marginTop: spacing.md,
  },
  cta: {
    marginTop: spacing.xl,
  },
});
