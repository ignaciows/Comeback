import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';

import { ActionBar, PrimaryButton, TextButton } from '@/components/Button';
import { Note } from '@/components/Feedback';
import { NumberInput } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { exerciseName } from '@/data/exercises';
import { buildInitialRoutine, estimateRoutineDayMinutes, firstBlockObjective } from '@/data/routineTemplates';
import { projectPlan } from '@/domain/plan/projection';
import { defaultStrategyFor, strategyProfile } from '@/domain/plan/strategies';
import type { GoalType } from '@/domain/types';
import { MilestoneTrack } from '@/features/plan/MilestoneTrack';
import { useAppStore, type OnboardingPayload } from '@/store/useAppStore';
import { fieldErrors, quickStartSchema } from './schema';
import { formatLongDate, today, weekdayLabel } from '@/utils/date';
import { round } from '@/utils/math';

/**
 * Four inputs and you are training: goal, weight, height, days per week.
 *
 * Everything else has a defensible default and is editable in Profile. The
 * point of onboarding is to get to a real first session, not to interview the
 * user before letting them in.
 */

const GOALS: { value: GoalType; label: string; detail: string }[] = [
  { value: 'recomposition', label: 'Recomposition', detail: 'Muscle up, fat down' },
  { value: 'build_muscle', label: 'Build muscle', detail: 'Add size' },
  { value: 'lose_fat', label: 'Lose fat', detail: 'Lean out, keep strength' },
  { value: 'regain_condition', label: 'Regain condition', detail: 'Get back to where you were' },
  { value: 'build_strength', label: 'Build strength', detail: 'Heavier main lifts' },
  { value: 'maintain', label: 'Maintain', detail: 'Hold what you have' },
];

/** Sensible spread of training days for each weekly frequency. */
const WEEKDAYS_FOR: Record<number, number[]> = {
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

const DEFAULTS = {
  sessionMinutes: 60,
  horizonWeeks: 16,
  layoffWeeks: 4,
  experience: 'returning' as const,
  location: 'gym' as const,
};

type Step = 0 | 1 | 2 | 3;

export function OnboardingFlow() {
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const beat = useLoop(motion.loop.heartbeat);

  const [step, setStep] = useState<Step>(0);
  const [goalType, setGoalType] = useState<GoalType | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const strategy = goalType ? defaultStrategyFor(goalType) : null;

  /** Target that the chosen strategy reaches in the default horizon. */
  const suggestedTarget = useMemo(() => {
    if (!strategy || weightKg === null) return null;
    const rate = strategyProfile(strategy).weeklyWeightChangePct * weightKg;
    return round(weightKg + rate * DEFAULTS.horizonWeeks, 1);
  }, [strategy, weightKg]);

  const routine = useMemo(() => {
    if (!goalType || !daysPerWeek) return null;
    return buildInitialRoutine({
      daysPerWeek,
      sessionMinutes: DEFAULTS.sessionMinutes,
      location: DEFAULTS.location,
      goalType,
      layoffWeeks: DEFAULTS.layoffWeeks,
    });
  }, [goalType, daysPerWeek]);

  const projection = useMemo(() => {
    if (!strategy || weightKg === null || heightCm === null || !daysPerWeek) return null;
    return projectPlan({
      today: today(),
      strategy,
      experience: DEFAULTS.experience,
      currentWeightKg: weightKg,
      heightCm,
      age: 30,
      sex: 'unspecified',
      targetWeightKg: targetWeightKg ?? suggestedTarget,
      sessionsPerWeek: daysPerWeek,
      sessionsCompleted: 0,
      goalStartedAt: today(),
      observedWeeklyRateKg: null,
      weeksOfWeightData: 0,
      adherence: 1,
    });
  }, [strategy, weightKg, heightCm, daysPerWeek, targetWeightKg, suggestedTarget]);

  const pulse = useAnimatedStyle(() => ({
    opacity: interpolate(beat.value, [0, 1], [0.5, 1]),
  }));

  const advance = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const pick = <T,>(setter: (value: T) => void, value: T, next: Step) => {
    Haptics.selectionAsync();
    setter(value);
    // Choosing is the confirmation; no extra tap to move on.
    setTimeout(() => advance(next), 140);
  };

  const finish = () => {
    if (!goalType || weightKg === null || heightCm === null || !daysPerWeek) return;
    const payload: OnboardingPayload = {
      name: '',
      heightCm,
      weightKg,
      experience: DEFAULTS.experience,
      layoffWeeks: DEFAULTS.layoffWeeks,
      goalType,
      strategy: strategy ?? undefined,
      targetWeightKg: targetWeightKg ?? suggestedTarget,
      horizonWeeks: DEFAULTS.horizonWeeks,
      daysPerWeek,
      sessionMinutes: DEFAULTS.sessionMinutes,
      preferredWeekdays: WEEKDAYS_FOR[daysPerWeek] ?? WEEKDAYS_FOR[4],
      location: DEFAULTS.location,
      // No check-in during onboarding; Today asks for it when it matters.
      checkin: {
        sleepHours: null,
        sleepQuality: null,
        energy: null,
        soreness: null,
        stress: null,
        motivation: null,
      },
      lastWorkoutDate: null,
      limitations: null,
    };
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    completeOnboarding(payload);
    router.replace('/(tabs)/today');
  };

  return (
    <Screen ambient>
      <View style={styles.progress}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.progressStep, index <= step && styles.progressStepDone]} />
        ))}
      </View>

      {step === 0 && (
        <Reveal>
          <Label style={styles.kicker}>Comeback</Label>
          <Text variant="title" style={styles.question}>
            What are you working towards?
          </Text>
          <View style={styles.options}>
            {GOALS.map((goal, index) => (
              <Reveal key={goal.value} index={index}>
                <Pressable
                  onPress={() => pick(setGoalType, goal.value, 1)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: goalType === goal.value }}
                  style={({ pressed }) => [
                    styles.card,
                    goalType === goal.value && styles.cardSelected,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <Text variant="heading">{goal.label}</Text>
                  <Text variant="bodySmall" tone="secondary">
                    {goal.detail}
                  </Text>
                </Pressable>
              </Reveal>
            ))}
          </View>
        </Reveal>
      )}

      {step === 1 && (
        <Reveal>
          <Label style={styles.kicker}>Step 2 of 4</Label>
          <Text variant="title" style={styles.question}>
            Where are you starting?
          </Text>
          <NumberInput
            label="Body weight"
            value={weightKg}
            onChange={setWeightKg}
            suffix="kg"
            step={0.25}
            precision={2}
            placeholder="77.25"
            style={styles.field}
          />
          <NumberInput
            label="Height"
            value={heightCm}
            onChange={setHeightCm}
            suffix="cm"
            step={1}
            precision={0}
            placeholder="186"
          />
          {error ? (
            <Text variant="caption" tone="danger" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <ActionBar>
            <PrimaryButton
              label="Continue"
              onPress={() => {
                const parsed = quickStartSchema
                  .pick({ weightKg: true, heightCm: true })
                  .safeParse({ weightKg, heightCm });
                if (!parsed.success) {
                  const errors = fieldErrors(parsed.error);
                  setError(errors.weightKg ?? errors.heightCm ?? 'Both values are needed to build your plan.');
                  return;
                }
                advance(2);
              }}
            />
            <TextButton label="Back" onPress={() => advance(0)} style={styles.back} />
          </ActionBar>
        </Reveal>
      )}

      {step === 2 && (
        <Reveal>
          <Label style={styles.kicker}>Step 3 of 4</Label>
          <Text variant="title" style={styles.question}>
            How many days a week can you train?
          </Text>
          <View style={styles.options}>
            {[3, 4, 5, 6].map((days, index) => (
              <Reveal key={days} index={index}>
                <Pressable
                  onPress={() => pick(setDaysPerWeek, days, 3)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: daysPerWeek === days }}
                  style={({ pressed }) => [
                    styles.card,
                    styles.cardRow,
                    daysPerWeek === days && styles.cardSelected,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <View>
                    <Text variant="heading">{`${days} days`}</Text>
                    <Text variant="bodySmall" tone="secondary">
                      {(WEEKDAYS_FOR[days] ?? []).map((day) => weekdayLabel(day)).join(' · ')}
                    </Text>
                  </View>
                  <Text variant="caption" tone="tertiary" mono>
                    {`${days * DEFAULTS.sessionMinutes} min/wk`}
                  </Text>
                </Pressable>
              </Reveal>
            ))}
          </View>
          <TextButton label="Back" onPress={() => advance(1)} style={styles.back} />
        </Reveal>
      )}

      {step === 3 && routine && projection && strategy && (
        <>
          <Reveal index={0}>
            <Label style={styles.kicker}>Your plan</Label>
            <Animated.View style={pulse}>
              <Text variant="title" style={styles.question}>
                {routine.name}
              </Text>
            </Animated.View>
            <Text variant="bodySmall" tone="secondary">
              {`${routine.daysPerWeek} days a week · ${strategyProfile(strategy).label.toLowerCase()} · about ${DEFAULTS.sessionMinutes} minutes a session`}
            </Text>
          </Reveal>

          <Reveal index={1} style={styles.block}>
            <MilestoneTrack
              completed={0}
              remaining={projection.sessionsRemaining}
              targetLabel={
                (targetWeightKg ?? suggestedTarget) !== null
                  ? `${(targetWeightKg ?? suggestedTarget)?.toFixed(1)} kg`
                  : 'no target yet'
              }
              footnote={projection.targetDate ? `Estimated ${formatLongDate(projection.targetDate)}` : undefined}
            />
          </Reveal>

          <Reveal index={2}>
            <Section title="Target weight" footnote="Adjust it now or later — the plan recalculates either way.">
              <NumberInput
                value={targetWeightKg ?? suggestedTarget}
                onChange={setTargetWeightKg}
                suffix="kg"
                step={0.5}
                precision={1}
              />
            </Section>
          </Reveal>

          <Reveal index={3}>
            <Section title="Structure">
              {routine.days.map((day, index) => (
                <View key={day.id}>
                  {index > 0 ? <Divider /> : null}
                  <MetricRow
                    label={day.name}
                    detail={day.exercises
                      .slice(0, 3)
                      .map((exercise) => exerciseName(exercise.exerciseId))
                      .join(' · ')}
                    value={`${estimateRoutineDayMinutes(day)}m`}
                  />
                </View>
              ))}
            </Section>
          </Reveal>

          <Reveal index={4}>
            <Section title="Daily targets">
              <MetricRow label="Calories" value={`${projection.targetKcal} kcal`} />
              <Divider />
              <MetricRow
                label="Protein"
                value={`${projection.proteinTargetG[0]}–${projection.proteinTargetG[1]} g`}
              />
            </Section>
          </Reveal>

          <Reveal index={5}>
            <Section title="First two weeks">
              <Text variant="bodySmall" tone="secondary">
                {firstBlockObjective({
                  daysPerWeek: routine.daysPerWeek,
                  sessionMinutes: DEFAULTS.sessionMinutes,
                  location: DEFAULTS.location,
                  goalType: goalType as GoalType,
                  layoffWeeks: DEFAULTS.layoffWeeks,
                })}
              </Text>
            </Section>
          </Reveal>

          <Note>
            Session length, training days, experience and everything else start on sensible defaults and are editable
            in Profile.
          </Note>

          <ActionBar>
            <PrimaryButton label="Start" onPress={finish} />
            <TextButton label="Back" onPress={() => advance(2)} style={styles.back} />
          </ActionBar>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xxl,
  },
  progressStep: {
    flex: 1,
    height: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  progressStepDone: {
    backgroundColor: colors.accent,
  },
  kicker: {
    marginBottom: spacing.sm,
  },
  question: {
    marginBottom: spacing.xl,
  },
  options: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  field: {
    marginBottom: spacing.lg,
  },
  error: {
    marginTop: spacing.md,
  },
  back: {
    alignSelf: 'center',
  },
  block: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xxl,
  },
});
