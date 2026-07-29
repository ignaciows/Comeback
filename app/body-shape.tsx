import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS, exerciseName } from '@/data/exercises';
import { deriveTrainingBias, remainingPotentialKg } from '@/domain/body/bodyType';
import {
  analyseComposition,
  bodyShape,
  describeDevelopment,
  frameSize,
  projectComposition,
  type BodyInput,
} from '@/domain/body/composition';
import { BodyComparison } from '@/features/body/BodyRender';
import { useBodyWeightSeries, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatLongDate } from '@/utils/date';

/**
 * What you look like now, and what the plan turns that into.
 *
 * The right-hand figure is drawn from the composition the plan predicts at the
 * end of the chosen phase — the same lean and fat numbers already shown as
 * kilograms elsewhere, put through the shape model. So the two drawings can
 * never disagree with the plan, and when the plan predicts very little the two
 * bodies look almost the same. That is the honest outcome, not a bug.
 */
export default function BodyShapeScreen() {
  const router = useRouter();
  const engine = useEngine();
  const profile = useAppStore((state) => state.profile);
  const weights = useBodyWeightSeries();

  const latest = weights[weights.length - 1] ?? null;
  const phases = engine.phases;
  const [phaseIndex, setPhaseIndex] = useState(phases.length - 1);

  const input: BodyInput | null = useMemo(() => {
    if (!profile || !latest) return null;
    return {
      heightCm: profile.heightCm,
      weightKg: latest.weightKg,
      bodyFatPercent: latest.bodyFatPercent,
      sex: profile.sex,
      wristCm: profile.wristCm,
      experience: profile.experience,
    };
  }, [profile, latest]);

  const view = useMemo(() => {
    if (!input || !profile) return null;

    const frame = frameSize(input.heightCm, input.wristCm);
    const now = analyseComposition(input);

    // Everything up to and including the chosen phase.
    const upTo = phases.slice(0, Math.max(1, phaseIndex + 1));
    const change = upTo.reduce(
      (total, phase) => ({
        leanKg: total.leanKg + phase.leanChangeKg,
        fatKg: total.fatKg + phase.fatChangeKg,
      }),
      { leanKg: 0, fatKg: 0 },
    );

    const later = projectComposition(input, change);

    return {
      frame,
      now,
      later,
      change,
      nowShape: bodyShape(now, frame),
      laterShape: bodyShape(later, frame),
      bias: deriveTrainingBias({
        composition: now,
        shape: bodyShape(now, frame),
        armLength: profile.armLength,
        legLength: profile.legLength,
      }),
      potential: remainingPotentialKg(now, input.heightCm),
      endsOn: phases[Math.min(phaseIndex, phases.length - 1)]?.endsOn ?? null,
    };
  }, [input, profile, phases, phaseIndex]);

  if (!input || !view) {
    return (
      <Screen>
        <Header title="Your body" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState
          title="Log your weight first"
          description="Height and weight are enough to start. Body fat from a scale sharpens it."
          action={{ label: 'Log weight', onPress: () => router.push('/log-weight') }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title="Your body"
        subtitle={view.endsOn ? `Now, and ${formatLongDate(view.endsOn)}` : 'Now'}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <View style={styles.card}>
          <BodyComparison
            now={view.nowShape}
            later={view.laterShape}
            nowLabel="Now"
            laterLabel={phases[phaseIndex]?.label ?? 'Target'}
            height={230}
            note={
              view.now.estimatedFat
                ? 'Body fat is estimated from height and weight. A scale that measures it makes this a lot sharper.'
                : undefined
            }
          />
        </View>
      </Reveal>

      {phases.length > 1 ? (
        <Reveal index={1}>
          <Section title="Through the plan">
            <SegmentedControl
              options={phases.map((phase, index) => ({ value: index, label: phase.label.slice(0, 8) }))}
              value={Math.min(phaseIndex, phases.length - 1)}
              onChange={setPhaseIndex}
              layout="wrap"
            />
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={2}>
        <View style={styles.numbers}>
          <View style={styles.stat}>
            <Label>Muscle</Label>
            <View style={styles.statValue}>
              <AnimatedNumber
                value={view.change.leanKg}
                decimals={1}
                prefix={view.change.leanKg > 0 ? '+' : ''}
                variant="title"
                style={{ color: colors.accent }}
              />
              <Text variant="bodySmall" tone="tertiary">
                kg
              </Text>
            </View>
          </View>
          <View style={styles.stat}>
            <Label>Fat</Label>
            <View style={styles.statValue}>
              <AnimatedNumber
                value={view.change.fatKg}
                decimals={1}
                prefix={view.change.fatKg > 0 ? '+' : ''}
                variant="title"
                style={{ color: view.change.fatKg > 0 ? colors.warning : colors.info }}
              />
              <Text variant="bodySmall" tone="tertiary">
                kg
              </Text>
            </View>
          </View>
          <View style={styles.stat}>
            <Label>Body fat</Label>
            <View style={styles.statValue}>
              <AnimatedNumber value={view.later.bodyFatPercent} decimals={1} variant="title" />
              <Text variant="bodySmall" tone="tertiary">
                %
              </Text>
            </View>
          </View>
        </View>
      </Reveal>

      <Reveal index={3}>
        <Section title="Where you are">
          <MetricRow
            label="Fat-free mass index"
            value={`${view.now.ffmi}`}
            accessory={view.now.estimatedFat ? <StatusPill label="estimated" tone="neutral" /> : undefined}
          />
          <Divider />
          <MetricRow label="Lean mass" value={`${view.now.leanKg} kg`} />
          <Divider />
          <MetricRow
            label="Muscle still available"
            value={view.potential > 0 ? `${view.potential} kg` : 'At the ceiling'}
            detail="Distance to the usual drug-free limit for your height"
          />
          <Text variant="bodySmall" tone="secondary" style={styles.reading}>
            {describeDevelopment(view.now, input.sex)}
          </Text>
        </Section>
      </Reveal>

      <Reveal index={4}>
        <Section
          title="What this body should train"
          footnote="From your proportions and leverages, not from a body type."
        >
          {view.bias.emphasise.length > 0 ? (
            <Label style={styles.emphasise}>
              {view.bias.emphasise.map((muscle) => MUSCLE_GROUP_LABELS[muscle]).join(' · ')}
            </Label>
          ) : null}

          {view.bias.reasons.map((reason) => (
            <Text key={reason} variant="bodySmall" tone="secondary" style={styles.reason}>
              {reason}
            </Text>
          ))}

          {view.bias.swaps.map((swap) => (
            <View key={`${swap.from}-${swap.to}`} style={styles.swap}>
              <Text variant="bodySmall">
                {`${exerciseName(swap.to)} instead of ${exerciseName(swap.from)}`}
              </Text>
              <Text variant="caption" tone="tertiary">
                {swap.because}
              </Text>
            </View>
          ))}
        </Section>
      </Reveal>

      <Reveal index={5}>
        <MetricRow
          label="Frame and proportions"
          detail={input.wristCm ? `Wrist ${input.wristCm} cm` : 'Add a wrist measurement to sharpen the drawing'}
          onPress={() => router.push('/you')}
          chevron
        />
      </Reveal>

      <Note>
        A silhouette from your own numbers, not a photo and not a promise. It moves only as much as the plan says it
        will.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  numbers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  stat: {
    gap: spacing.sm,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  reading: {
    marginTop: spacing.lg,
  },
  emphasise: {
    marginBottom: spacing.md,
  },
  reason: {
    marginBottom: spacing.md,
  },
  swap: {
    marginTop: spacing.md,
    gap: 2,
  },
});
