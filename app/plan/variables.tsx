import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { BottomSheet } from '@/components/BottomSheet';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import {
  PLAN_VARIABLES,
  describeChange,
  planVariablesOf,
  valueLabel,
  type PlanVariables,
  type VariableDefinition,
} from '@/domain/plan/planVariables';
import type { MuscleGroup } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';

/**
 * Every lever that changes the plan, in one place, behaving the same way.
 *
 * They used to be spread across onboarding, `/adjust`, `/focus`, the
 * fat-ceiling screen and the plan tab, and they did not agree with each other:
 * some recalculated on change, some wrote a field and left the projections
 * stale until something else happened to rebuild them. The user had no way to
 * tell which was which, and "did that actually do anything?" is a question an
 * app should never make anyone ask.
 *
 * One rule now: move anything here, get the same question, and on yes the same
 * deterministic recalculation through `applyPlanIntent`. On no, the lever goes
 * back where it was — a confirmation that leaves the control showing the value
 * you did not commit to is worse than no confirmation.
 *
 * The rows are generated from `PLAN_VARIABLES` rather than written out, which
 * is what stops someone adding a lever later that quietly skips the recalc.
 */
export default function PlanVariablesScreen() {
  const router = useRouter();
  const goal = useAppStore((state) => state.goal);
  const training = useAppStore((state) => state.training);
  const applyPlanIntent = useAppStore((state) => state.applyPlanIntent);

  const committed = useMemo(() => planVariablesOf(goal, training), [goal, training]);

  /** The value waiting on a yes. Null whenever nothing is pending. */
  const [pending, setPending] = useState<PlanVariables | null>(null);
  const change = pending ? describeChange(committed, pending) : null;

  const propose = (next: PlanVariables) => {
    Haptics.selectionAsync();
    setPending(next);
  };

  const confirm = () => {
    if (!pending) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    applyPlanIntent({
      objective: pending.objective,
      speed: pending.speed,
      fatTolerance: pending.fatTolerance,
      horizonWeeks: pending.horizonWeeks,
      maxBodyFatPercent: pending.maxBodyFatPercent,
      muscleFocus: pending.muscleFocus,
      daysPerWeek: pending.daysPerWeek,
      sessionMinutes: pending.sessionMinutes,
    });
    setPending(null);
  };

  // Saying no puts the control back where it was, rather than leaving it
  // showing a value the plan was never rebuilt around.
  const cancel = () => setPending(null);

  const shown = pending ?? committed;

  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title="Plan variables"
        subtitle="Everything that changes the plan"
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <Note>
          Change any of these and the whole plan is rebuilt from it — calories, training days, the
          routine and every projection. You will be asked first, every time.
        </Note>
      </Reveal>

      {PLAN_VARIABLES.map((definition, index) => (
        <Reveal key={definition.key} index={index + 1}>
          <Section title={definition.label} footnote={definition.help}>
            {definition.kind === 'muscles' ? (
              <MuscleChoice
                selected={shown.muscleFocus}
                onChange={(muscleFocus) => propose({ ...shown, muscleFocus })}
              />
            ) : (
              <Choice
                definition={definition}
                value={shown[definition.key]}
                onChange={(value) => propose({ ...shown, [definition.key]: value } as PlanVariables)}
              />
            )}
          </Section>
        </Reveal>
      ))}

      <BottomSheet
        visible={change !== null}
        onClose={cancel}
        title="Recalculate your plan?"
        subtitle={change?.headline}
      >
        <Text variant="body" tone="secondary">
          {change?.detail}
        </Text>
        <PrimaryButton label="Recalculate" onPress={confirm} style={styles.confirm} />
        <TextButton label="Leave it as it was" onPress={cancel} style={styles.cancel} />
      </BottomSheet>
    </Screen>
  );
}

function Choice({
  definition,
  value,
  onChange,
}: {
  definition: VariableDefinition;
  value: PlanVariables[keyof PlanVariables];
  onChange: (value: string | number | null) => void;
}) {
  return (
    <View style={styles.options}>
      {definition.options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${definition.label}: ${option.label}`}
            style={({ pressed }) => [
              styles.option,
              selected && styles.optionOn,
              pressed && { opacity: opacity.pressed },
            ]}
          >
            <Text variant="bodySmall" style={selected ? styles.optionTextOn : undefined}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multi-select, because favouring two muscles is a normal thing to want. */
function MuscleChoice({
  selected,
  onChange,
}: {
  selected: MuscleGroup[];
  onChange: (value: MuscleGroup[]) => void;
}) {
  const definition = PLAN_VARIABLES.find((entry) => entry.key === 'muscleFocus')!;

  return (
    <View>
      <View style={styles.options}>
        {definition.options.map((option) => {
          const muscle = option.value as MuscleGroup;
          const on = selected.includes(muscle);
          return (
            <Pressable
              key={muscle}
              onPress={() =>
                onChange(on ? selected.filter((entry) => entry !== muscle) : [...selected, muscle])
              }
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.option,
                on && styles.optionOn,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Text variant="bodySmall" style={on ? styles.optionTextOn : undefined}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Label style={styles.current}>{valueLabel(definition, selected)}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
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
  current: {
    marginTop: spacing.md,
  },
  confirm: {
    marginTop: spacing.xl,
  },
  cancel: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
});
