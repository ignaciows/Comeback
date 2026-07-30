import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { buildRoadmap, type RoadmapStop } from '@/domain/plan/roadmap';
import { useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';

/**
 * The whole plan, stop by stop.
 *
 * The question this exists to answer is the one people actually ask: *what am
 * I supposed to eat, and what am I supposed to be doing, and when does that
 * change?* A plan described as sixteen weeks of recomposition answers none of
 * it. Weeks 1–6, 2,900 kcal, loads climbing — then weeks 7–12, 2,200, hold
 * what you built — answers all of it.
 *
 * Four numbers per stop and one sentence about the training. No charts, no
 * second model: it is a reading of the phases the plan already produced, so it
 * cannot drift from what the app is actually doing.
 */
export default function RoadmapScreen() {
  const router = useRouter();
  const engine = useEngine();
  const goal = useAppStore((state) => state.goal);
  const measurements = useAppStore((state) => state.bodyMeasurements);

  const weightKg = [...measurements].sort((a, b) => (a.date < b.date ? -1 : 1)).at(-1)?.weightKg ?? 80;
  const proteinGPerKg = goal && goal.proteinTargetG ? goal.proteinTargetG / weightKg : 1.8;

  const stops = buildRoadmap({
    phases: engine.phases,
    currentWeightKg: weightKg,
    proteinGPerKg,
  });

  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title="The road"
        subtitle={stops.length > 0 ? `${stops.length} phases · ${stops.at(-1)?.toWeek} weeks` : undefined}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {stops.length === 0 ? (
        <Text variant="body" tone="secondary" style={styles.empty}>
          Set a target and the road appears here, phase by phase.
        </Text>
      ) : null}

      {stops.map((stop, index) => (
        <Reveal key={stop.phase.startsOn} index={index}>
          <Stop stop={stop} last={index === stops.length - 1} />
        </Reveal>
      ))}
    </Screen>
  );
}

function Stop({ stop, last }: { stop: RoadmapStop; last: boolean }) {
  const { phase, macros, training } = stop;
  const current = phase.state === 'current';
  const done = phase.state === 'done';

  return (
    <View style={styles.row}>
      {/* The spine: a dot per phase, joined by a line. Filled behind you. */}
      <View style={styles.rail}>
        <View style={[styles.dot, current && styles.dotNow, done && styles.dotDone]}>
          {done ? <Icon name="check" size={10} color={colors.background} /> : null}
        </View>
        {last ? null : <View style={[styles.line, done && styles.lineDone]} />}
      </View>

      <View style={[styles.card, current && styles.cardNow, done && styles.cardDone]}>
        <View style={styles.head}>
          <Label>{stop.span}</Label>
          {current ? (
            <View style={styles.now}>
              <Text variant="caption" style={styles.nowText}>
                Now
              </Text>
            </View>
          ) : null}
        </View>

        <Text variant="title" style={styles.label}>
          {phase.label}
        </Text>

        {/* Eat this much. Four numbers, no prose. */}
        <View style={styles.macros}>
          <Macro value={macros.kcal} unit="kcal" wide />
          <Macro value={macros.proteinG} unit="g protein" />
          <Macro value={macros.carbsG} unit="g carbs" />
          <Macro value={macros.fatG} unit="g fat" />
        </View>

        {stop.changeFromPrevious ? (
          <Text variant="caption" tone="tertiary" style={styles.change}>
            {stop.changeFromPrevious}
          </Text>
        ) : null}

        {/* Train like this. */}
        <View style={styles.training}>
          <Icon name="train" size={14} color={colors.textTertiary} />
          <View style={styles.trainingText}>
            <Text variant="body">{training.label}</Text>
            <Text variant="caption" tone="tertiary">
              {training.detail}
            </Text>
          </View>
        </View>

        <Text variant="caption" tone="secondary" style={styles.story}>
          {phase.story}
        </Text>
      </View>
    </View>
  );
}

function Macro({ value, unit, wide }: { value: number; unit: string; wide?: boolean }) {
  return (
    <View style={[styles.macro, wide && styles.macroWide]}>
      <Text variant="title" mono>
        {value}
      </Text>
      <Text variant="caption" tone="tertiary">
        {unit}
      </Text>
    </View>
  );
}

const RAIL = 24;

const styles = StyleSheet.create({
  empty: {
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  rail: {
    width: RAIL,
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: radius.pill,
    borderWidth: borderWidth.thick,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotNow: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dotDone: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accentMuted,
  },
  line: {
    flex: 1,
    width: borderWidth.hairline,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  lineDone: {
    backgroundColor: colors.accentMuted,
  },
  card: {
    flex: 1,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  cardNow: {
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
  },
  cardDone: {
    opacity: 0.6,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  now: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  nowText: {
    color: colors.background,
  },
  label: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  macros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  macro: {
    minWidth: 72,
  },
  macroWide: {
    minWidth: 92,
  },
  change: {
    marginTop: spacing.md,
  },
  training: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: colors.border,
  },
  trainingText: {
    flex: 1,
    gap: spacing.xs,
  },
  story: {
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
