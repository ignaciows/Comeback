import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import type { PlanPhaseView } from '@/domain/plan/phases';

/**
 * Every day of the plan, as a square, grouped by phase.
 *
 * Six hundred days drawn as one long strip is an ocean — the honest reaction
 * is "this never ends", and someone who feels that on the plan screen does not
 * start. The same six hundred days cut into eight labelled groups say
 * something different and equally true: *it is a lot, and it is finite, and you
 * are inside the second one*.
 *
 * So the squares stay small enough that a year fits, but each group is a
 * bordered block with its own heading and count. The eye lands on eight
 * things, not on six hundred.
 *
 * Contrast carries the state rather than colour alone: done is filled, today
 * is the accent with a ring, and what is ahead is an outline. A grid where
 * every square is a slightly different grey tells you nothing at a glance.
 */

export type PhaseGridProps = {
  phases: PlanPhaseView[];
  onPressPhase?: (phase: PlanPhaseView) => void;
  style?: ViewStyle;
};

/** Above this many days a phase draws a compressed row rather than every day. */
const MAX_SQUARES = 84;

export function PhaseGrid({ phases, onPressPhase, style }: PhaseGridProps) {
  return (
    <View style={[styles.wrap, style]}>
      {phases.map((phase, index) => (
        <PhaseBlock
          key={`${phase.startsOn}-${index}`}
          phase={phase}
          index={index}
          onPress={onPressPhase ? () => onPressPhase(phase) : undefined}
        />
      ))}
    </View>
  );
}

function PhaseBlock({
  phase,
  index,
  onPress,
}: {
  phase: PlanPhaseView;
  index: number;
  onPress?: () => void;
}) {
  const current = phase.state === 'current';
  const done = phase.state === 'done';

  // A very long phase compresses: one square per two or three days rather than
  // a wall nobody can count anyway.
  const perSquare = Math.max(1, Math.ceil(phase.days / MAX_SQUARES));
  const squares = Math.ceil(phase.days / perSquare);
  const filled = Math.floor(phase.daysDone / perSquare);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${phase.label}, ${phase.days} days, ${phase.daysDone} done`}
      style={({ pressed }) => [
        styles.block,
        current && styles.blockNow,
        done && styles.blockDone,
        pressed && onPress ? { opacity: opacity.pressed } : null,
      ]}
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text variant="caption" tone="tertiary" mono>
            {`${index + 1}`.padStart(2, '0')}
          </Text>
          <Text variant="body" style={current ? styles.labelNow : undefined}>
            {phase.label}
          </Text>
        </View>

      {/* Where this phase leaves you, and what it is for. The grid answers
          "how long"; without these it never answers "and then what". */}
      {phase.endWeightKg !== null ? (
        <Text variant="caption" tone="secondary" mono style={styles.projection}>
          {phase.endBodyFatPercent !== null
            ? `→ ${phase.endWeightKg} kg · ${phase.endBodyFatPercent}% body fat`
            : `→ ${phase.endWeightKg} kg`}
        </Text>
      ) : null}

      <Text variant="caption" tone="tertiary" style={styles.story} numberOfLines={3}>
        {phase.story}
      </Text>

        <Text variant="caption" tone="tertiary" mono>
          {done ? `${phase.days}d` : `${phase.daysDone}/${phase.days}d`}
        </Text>
      </View>

      <View style={styles.squares}>
        {Array.from({ length: squares }, (_, position) => {
          const isDone = position < filled;
          const isToday = current && position === filled;

          return (
            <View
              key={position}
              style={[
                styles.square,
                isDone && styles.squareDone,
                isToday && styles.squareToday,
              ]}
            />
          );
        })}
      </View>

      {perSquare > 1 ? (
        <Text variant="caption" tone="tertiary" style={styles.scale}>
          {`one square = ${perSquare} days`}
        </Text>
      ) : null}
    </Pressable>
  );
}

const SQUARE = 9;

const styles = StyleSheet.create({
  projection: {
    marginTop: spacing.xs,
  },
  story: {
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  wrap: {
    gap: spacing.md,
  },
  block: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  blockNow: {
    borderColor: colors.accent,
    borderWidth: borderWidth.thick,
    backgroundColor: colors.accentSurface,
  },
  blockDone: {
    opacity: 0.55,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    flex: 1,
  },
  labelNow: {
    color: colors.accent,
  },
  squares: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  square: {
    width: SQUARE,
    height: SQUARE,
    borderRadius: 2,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  squareDone: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accentMuted,
  },
  squareToday: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  scale: {
    marginTop: spacing.xs,
  },
});
