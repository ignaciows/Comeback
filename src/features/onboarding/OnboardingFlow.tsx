import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionBar, PrimaryButton, TextButton } from '@/components/Button';
import { Note, StatusPill } from '@/components/Feedback';
import { NumberInput } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { buildInitialRoutine, estimateRoutineDayMinutes } from '@/data/routineTemplates';
import {
  OBJECTIVE_LABELS,
  SPEEDS,
  SPEED_LABELS,
  simulatePlan,
  suggestTargetWeight,
  type SimulationInput,
} from '@/domain/plan/simulate';
import { CALIBRATION_DAYS_PER_WEEK } from '@/domain/plan/calibration';
import type { FatTolerance, GoalType, PlanObjective, PlanSpeed } from '@/domain/types';
import { MilestoneTrack } from '@/features/plan/MilestoneTrack';
import { useAppStore, WEEKDAYS_FOR, type OnboardingPayload } from '@/store/useAppStore';
import { formatLongDate, today } from '@/utils/date';
import { fieldErrors, quickStartSchema } from './schema';

/**
 * Three questions, then the plan.
 *
 * The app never asks how many days a week you can train or what to eat — those
 * are consequences of what you want and how fast, so it works them out. The
 * pace screen shows each option's result before you pick it, so the decision is
 * made with the numbers already in front of you.
 */

const OBJECTIVES: { value: PlanObjective; goalType: GoalType; label: string; detail: string }[] = [
  { value: 'build', goalType: 'build_muscle', label: OBJECTIVE_LABELS.build, detail: 'Get bigger and stronger' },
  { value: 'lean', goalType: 'lose_fat', label: OBJECTIVE_LABELS.lean, detail: 'Lose fat, keep your strength' },
  {
    value: 'recomp',
    goalType: 'recomposition',
    label: OBJECTIVE_LABELS.recomp,
    detail: 'Muscle up and fat down together',
  },
];

const DEFAULTS = {
  sessionMinutes: 60,
  horizonWeeks: 12,
  layoffWeeks: 4,
  experience: 'returning' as const,
  location: 'gym' as const,
  fatTolerance: 'some' as FatTolerance,
};

type Step = 0 | 1 | 2 | 3 | 4;

/**
 * The route the fortnight hands over to, from what they said they want.
 *
 * Picking it here rather than asking is the same principle as everywhere else
 * in this flow: the objective already answers it, and the plan screen can
 * change it afterwards. What matters is that a route exists to transition
 * *into*, so calibration is a first block rather than a detour.
 */
const ROUTE_FOR_OBJECTIVE: Record<PlanObjective, string> = {
  build: 'lean_bulk_then_short_cut',
  lean: 'cut_then_build',
  recomp: 'recomp',
};

export function OnboardingFlow() {
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const startCalibration = useAppStore((state) => state.startCalibration);

  const [step, setStep] = useState<Step>(0);
  const [objective, setObjective] = useState<PlanObjective | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [speed, setSpeed] = useState<PlanSpeed | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const baseInput = useMemo((): Omit<SimulationInput, 'speed' | 'targetWeightKg'> | null => {
    if (!objective || weightKg === null || heightCm === null) return null;
    return {
      today: today(),
      objective,
      fatTolerance: DEFAULTS.fatTolerance,
      currentWeightKg: weightKg,
      heightCm,
      age: 30,
      sex: 'unspecified',
      experience: DEFAULTS.experience,
      horizonWeeks: DEFAULTS.horizonWeeks,
      sessionsCompleted: 0,
      goalStartedAt: today(),
      observedWeeklyRateKg: null,
      weeksOfWeightData: 0,
      adherence: 1,
    };
  }, [objective, weightKg, heightCm]);

  /** Every pace, simulated, so the choice is made with the result visible. */
  const options = useMemo(() => {
    if (!baseInput) return [];
    return SPEEDS.map((value) => ({
      speed: value,
      result: simulatePlan({ ...baseInput, speed: value, targetWeightKg: null }),
    }));
  }, [baseInput]);

  const chosen = useMemo(() => {
    if (!baseInput || !speed) return null;
    const target = targetWeightKg ?? suggestTargetWeight({ ...baseInput, speed });
    return { target, result: simulatePlan({ ...baseInput, speed, targetWeightKg: target }) };
  }, [baseInput, speed, targetWeightKg]);

  const routine = useMemo(() => {
    if (!objective || !chosen) return null;
    return buildInitialRoutine({
      daysPerWeek: chosen.result.daysPerWeek,
      sessionMinutes: DEFAULTS.sessionMinutes,
      location: DEFAULTS.location,
      goalType: OBJECTIVES.find((entry) => entry.value === objective)?.goalType ?? 'recomposition',
      layoffWeeks: DEFAULTS.layoffWeeks,
    });
  }, [objective, chosen]);

  const advance = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const finish = () => {
    if (!objective || !speed || !chosen || weightKg === null || heightCm === null) return;
    const payload: OnboardingPayload = {
      name: '',
      heightCm,
      weightKg,
      experience: DEFAULTS.experience,
      layoffWeeks: DEFAULTS.layoffWeeks,
      goalType: OBJECTIVES.find((entry) => entry.value === objective)?.goalType ?? 'recomposition',
      objective,
      speed,
      fatTolerance: DEFAULTS.fatTolerance,
      strategy: chosen.result.strategy,
      targetWeightKg: chosen.target,
      horizonWeeks: DEFAULTS.horizonWeeks,
      // Frequency is an output of the pace, not a question.
      daysPerWeek: chosen.result.daysPerWeek,
      sessionMinutes: DEFAULTS.sessionMinutes,
      preferredWeekdays: WEEKDAYS_FOR[chosen.result.daysPerWeek] ?? WEEKDAYS_FOR[4],
      location: DEFAULTS.location,
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
    // The plan they chose is what they get — two weeks later, and built on
    // measurements rather than on the answers to three questions.
    startCalibration(ROUTE_FOR_OBJECTIVE[objective]);
    router.replace('/(tabs)/today');
  };

  return (
    <Screen ambient>
      <View style={styles.progress}>
        {[0, 1, 2, 3, 4].map((index) => (
          <View key={index} style={[styles.progressStep, index <= step && styles.progressStepDone]} />
        ))}
      </View>

      {step === 0 && (
        <Reveal>
          <Label style={styles.kicker}>Comeback</Label>
          <Text variant="title" style={styles.question}>
            What do you want?
          </Text>
          <View style={styles.options}>
            {OBJECTIVES.map((entry, index) => (
              <Reveal key={entry.value} index={index}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    setObjective(entry.value);
                    setTimeout(() => advance(1), 140);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: objective === entry.value }}
                  style={({ pressed }) => [
                    styles.card,
                    objective === entry.value && styles.cardSelected,
                    pressed && { opacity: opacity.pressed },
                  ]}
                >
                  <Text variant="heading">{entry.label}</Text>
                  <Text variant="bodySmall" tone="secondary">
                    {entry.detail}
                  </Text>
                </Pressable>
              </Reveal>
            ))}
          </View>
        </Reveal>
      )}

      {step === 1 && (
        <Reveal>
          <Label style={styles.kicker}>Step 2 of 3</Label>
          <Text variant="title" style={styles.question}>
            Where are you starting?
          </Text>
          <View style={styles.fields}>
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
          </View>
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
                  setError(errors.weightKg ?? errors.heightCm ?? 'Both are needed to build your plan.');
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
          <Label style={styles.kicker}>Step 3 of 3</Label>
          <Text variant="title" style={styles.question}>
            How fast do you want it?
          </Text>
          <Text variant="bodySmall" tone="secondary" style={styles.subtitle}>
            {`What each pace gets you in ${DEFAULTS.horizonWeeks} weeks, and what it asks for.`}
          </Text>
          <View style={styles.options}>
            {options.map((option, index) => {
              const change = option.result.outcome.weightChangeKg;
              const gaining = change > 0;
              return (
                <Reveal key={option.speed} index={index}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSpeed(option.speed);
                      setTimeout(() => advance(3), 140);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: speed === option.speed }}
                    style={({ pressed }) => [
                      styles.card,
                      speed === option.speed && styles.cardSelected,
                      pressed && { opacity: opacity.pressed },
                    ]}
                  >
                    <View style={styles.cardHead}>
                      <Text variant="heading">{SPEED_LABELS[option.speed]}</Text>
                      <Text
                        variant="heading"
                        mono
                        style={{
                          color:
                            option.result.feasibility === 'not_useful' ? colors.warning : colors.accent,
                        }}
                      >
                        {`${gaining ? '+' : ''}${change} kg`}
                      </Text>
                    </View>
                    <Text variant="bodySmall" tone="secondary" style={styles.cardLine}>
                      {gaining
                        ? `${Math.abs(option.result.outcome.leanChangeKg)} kg lean · ${Math.abs(option.result.outcome.fatChangeKg)} kg fat`
                        : `${Math.abs(option.result.outcome.fatChangeKg)} kg fat · ${Math.abs(option.result.outcome.leanChangeKg)} kg lean`}
                    </Text>
                    <View style={styles.cardFoot}>
                      <Text variant="caption" tone="tertiary">
                        {`${option.result.daysPerWeek} days a week · ${option.result.macros.kcal} kcal`}
                      </Text>
                      {option.result.feasibility === 'not_useful' ? (
                        <StatusPill label="mostly fat" tone="warning" />
                      ) : null}
                    </View>
                  </Pressable>
                </Reveal>
              );
            })}
          </View>
          <TextButton label="Back" onPress={() => advance(1)} style={styles.back} />
        </Reveal>
      )}

      {step === 3 && chosen && routine && (
        <>
          <Reveal index={0}>
            <Label style={styles.kicker}>Your plan</Label>
            <Text variant="title" style={styles.question}>
              {routine.name}
            </Text>
            <Text variant="bodySmall" tone="secondary">
              {`${chosen.result.daysPerWeek} days a week · ${chosen.result.strategyLabel.toLowerCase()} · ${chosen.result.macros.kcal} kcal a day`}
            </Text>
          </Reveal>

          <Reveal index={1} style={styles.block}>
            <MilestoneTrack
              completed={0}
              remaining={chosen.result.projection.sessionsRemaining}
              targetLabel={`${chosen.target.toFixed(1)} kg`}
              footnote={
                chosen.result.projection.targetDate
                  ? `Estimated ${formatLongDate(chosen.result.projection.targetDate)}`
                  : undefined
              }
            />
          </Reveal>

          <Reveal index={2}>
            <Section title="What this needs from you">
              {chosen.result.requirements.map((requirement) => (
                <View key={requirement.key} style={styles.bullet}>
                  <View style={styles.dot} />
                  <Text variant="bodySmall" style={styles.bulletText}>
                    {requirement.label}
                  </Text>
                </View>
              ))}
            </Section>
          </Reveal>

          <Reveal index={3}>
            <Section title="Your week">
              {routine.days.map((day, index) => (
                <View key={day.id}>
                  {index > 0 ? <Divider /> : null}
                  <MetricRow label={day.name} value={`${estimateRoutineDayMinutes(day)}m`} />
                </View>
              ))}
            </Section>
          </Reveal>

          <Reveal index={4}>
            <Section title="Target weight" footnote="Change it now or any time from Plan.">
              <NumberInput
                value={targetWeightKg ?? chosen.target}
                onChange={setTargetWeightKg}
                suffix="kg"
                step={0.5}
                precision={1}
              />
            </Section>
          </Reveal>

          <Note>Everything adjusts later, and the plan recalculates from what you actually do.</Note>

          <ActionBar>
            <PrimaryButton label="Continue" onPress={() => advance(4)} />
            <TextButton label="Back" onPress={() => advance(2)} style={styles.back} />
          </ActionBar>
        </>
      )}

      {/*
        The fortnight, explained before it starts rather than discovered.

        Someone who asked for an ambitious plan and silently receives an easy
        first two weeks concludes the app ignored them. The same fortnight,
        announced, reads as the app taking them seriously enough to measure
        first — which is what it is doing.
      */}
      {step === 4 && chosen && (
        <>
          <Reveal index={0}>
            <Label style={styles.kicker}>Before your plan</Label>
            <Text variant="title" style={styles.question}>
              Two weeks of calibration
            </Text>
            <Text variant="bodySmall" tone="secondary" style={styles.subtitle}>
              {`Before your ${Math.round(DEFAULTS.horizonWeeks / 4)}-month plan, two weeks of calibration. Fewer exercises, more attention on form — so we measure what you are actually capable of and build the plan around that instead of around a guess.`}
            </Text>
          </Reveal>

          <Reveal index={1}>
            <Section title="What these two weeks look like">
              {[
                `${CALIBRATION_DAYS_PER_WEEK} days a week, full body — a frequency you will actually hit.`,
                'Five movements only: squat, bench, row, overhead press, deadlift.',
                'Three sets each, stopping well short of failure. This is a measurement, not a test.',
                'Eating at maintenance, so the scale is not moving while we read it.',
              ].map((line) => (
                <View key={line} style={styles.bullet}>
                  <View style={styles.dot} />
                  <Text variant="bodySmall" style={styles.bulletText}>
                    {line}
                  </Text>
                </View>
              ))}
            </Section>
          </Reveal>

          <Reveal index={2}>
            <Section title="Then what">
              <Text variant="bodySmall" tone="secondary">
                {`At the end of week two the app knows your starting loads, how long a session really takes you and how many days you actually train. Your plan — ${chosen.result.strategyLabel.toLowerCase()} — is rebuilt from those numbers and starts on its own.`}
              </Text>
            </Section>
          </Reveal>

          <Note>You can skip straight to the plan later if you would rather. Nothing is locked.</Note>

          <ActionBar>
            <PrimaryButton label="Start the two weeks" onPress={finish} />
            <TextButton label="Back" onPress={() => advance(3)} style={styles.back} />
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    marginBottom: spacing.lg,
  },
  options: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLine: {
    marginTop: spacing.xs,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  fields: {
    marginTop: spacing.lg,
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
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
    backgroundColor: colors.accent,
  },
  bulletText: {
    flex: 1,
  },
});
