import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { TextButton } from '@/components/Button';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { colors, opacity, radius, spacing } from '@/design-system/tokens';
import { buildWarmup, warmupSummary, type WarmupPhase, type WarmupStep } from '@/domain/training/warmup';
import type { WorkoutSession } from '@/domain/types';
import { previousPerformance } from '@/features/training/history';

type Props = {
  session: WorkoutSession;
  /** Every session ever logged; the ramp is built off what you last lifted. */
  history: WorkoutSession[];
};

const PHASE_LABEL: Record<WarmupPhase, string> = {
  raise: 'Raise',
  mobilise: 'Prepare',
  ramp: 'Ramp',
};

/**
 * The warm-up, at the top of the session and before anything heavy.
 *
 * Collapsed to one line once every step is ticked, because a warm-up you have
 * finished is not information any more — it is a thing taking up the space
 * where the first exercise should be.
 *
 * Ticking is local state on purpose. A warm-up is not a set: it does not
 * belong in the history, it does not count towards volume, and persisting it
 * would put "did three ankle rocks" into the same record as the lifts.
 */
export function WarmupCard({ session, history }: Props) {
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(true);

  const warmup = useMemo(
    () =>
      buildWarmup({
        exercises: session.exercises
          .filter((exercise) => !exercise.skipped)
          .map((exercise) => ({
            exerciseId: exercise.exerciseId,
            // Today's planned load if there is one, else what you actually
            // put on the bar last time. A ramp to a weight nobody chose yet
            // would be three sets of arithmetic about nothing.
            workingWeightKg:
              exercise.sets.find((set) => !set.warmup)?.weightKg ??
              previousPerformance(history, exercise.exerciseId, session.id)?.sets[0]?.weightKg ??
              null,
          })),
      }),
    [session.exercises, session.id, history],
  );

  const complete = done.size >= warmup.steps.length;

  const toggle = (step: WarmupStep) => {
    Haptics.selectionAsync();
    setDone((current) => {
      const next = new Set(current);
      if (next.has(step.id)) next.delete(step.id);
      else next.add(step.id);
      return next;
    });
  };

  if (complete && !open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.collapsed, pressed && { opacity: opacity.pressed }]}
        accessibilityRole="button"
        accessibilityLabel="Show warm-up again"
      >
        <Icon name="check" size={16} color={colors.accent} />
        <Text variant="bodySmall" tone="secondary">
          {`Warm-up done · ${warmup.minutes} min`}
        </Text>
      </Pressable>
    );
  }

  let lastPhase: WarmupPhase | null = null;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Label>Warm-up</Label>
          <Text variant="bodySmall" tone="secondary">
            {warmupSummary(warmup)}
          </Text>
        </View>
        <TextButton
          label={complete ? 'Hide' : 'Skip'}
          onPress={() => {
            setDone(new Set(warmup.steps.map((step) => step.id)));
            setOpen(false);
          }}
        />
      </View>

      {warmup.steps.map((step) => {
        const heading = step.phase !== lastPhase ? PHASE_LABEL[step.phase] : null;
        lastPhase = step.phase;
        const ticked = done.has(step.id);

        return (
          <View key={step.id}>
            {heading ? <Label style={styles.phase}>{heading}</Label> : null}
            <Pressable
              onPress={() => toggle(step)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked }}
              accessibilityLabel={`${step.label}, ${step.prescription}`}
              style={({ pressed }) => [styles.step, pressed && { opacity: opacity.pressed }]}
            >
              <View style={[styles.box, ticked && styles.boxOn]}>
                {ticked ? <Icon name="check" size={12} color={colors.background} /> : null}
              </View>
              <View style={styles.stepBody}>
                <Text variant="body" tone={ticked ? 'tertiary' : 'primary'}>
                  {step.label}
                </Text>
                {step.reason && !ticked ? (
                  <Text variant="caption" tone="tertiary">
                    {step.reason}
                  </Text>
                ) : null}
              </View>
              <Text variant="bodySmall" mono tone={ticked ? 'tertiary' : 'secondary'}>
                {step.prescription}
              </Text>
            </Pressable>
          </View>
        );
      })}

      {complete ? (
        <TextButton label="Warm-up done — hide it" onPress={() => setOpen(false)} style={styles.finish} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  collapsed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  phase: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepBody: {
    flex: 1,
    gap: 2,
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  finish: {
    marginTop: spacing.sm,
  },
});
