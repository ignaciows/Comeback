import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

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
import { analyseComposition, bodyShape, frameSize, type BodyInput } from '@/domain/body/composition';
import {
  OBJECTIVE_LABELS,
  SPEEDS,
  SPEED_LABELS,
  distinctPaces,
  simulatePlan,
  suggestTargetWeight,
  type SimulationInput,
} from '@/domain/plan/simulate';
import type { FatTolerance, GoalType, PlanObjective, PlanSpeed } from '@/domain/types';
import { BodyRender } from '@/features/body/BodyRender';
import { MilestoneTrack } from '@/features/plan/MilestoneTrack';
import { useAppStore, WEEKDAYS_FOR, type OnboardingPayload } from '@/store/useAppStore';
import { formatLongDate, today } from '@/utils/date';
import { fieldErrors, quickStartSchema } from './schema';

/**
 * Three questions, then the plan.
 *
 * The app never asks how many days a week you can train or what to eat — those
 * are consequences of what you want and how fast, so it works them out.
 *
 * You type two numbers and a body appears: that is you, drawn from what you
 * just entered, and it is the first thing in the flow that is a picture rather
 * than a sentence.
 *
 * It stops there deliberately. The obvious next move was to draw the body each
 * pace leads to and let people choose by looking — that was built, rendered,
 * and thrown away, because twelve weeks of difference between a gentle pace and
 * a hard one does not survive being drawn as a silhouette. All four came out
 * the same figure. What does show is the *split*: the fast paces put on more
 * weight and much more of it is fat, so each option carries a two-part bar
 * instead. That is the decision actually being made here.
 *
 * The pace no longer advances the moment it is tapped, either. A screen whose
 * job is to let you compare options cannot also close itself on the first one
 * you touch.
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

type Step = 0 | 1 | 2 | 3;

export function OnboardingFlow() {
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  const [step, setStep] = useState<Step>(0);
  const [objective, setObjective] = useState<PlanObjective | null>(null);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  // Starts on the middle pace so the preview has something to draw. An empty
  // screen teaches nobody what the screen is for.
  const [speed, setSpeed] = useState<PlanSpeed | null>('steady');
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

  /**
   * Every pace, simulated, then narrowed to the ones that differ. Two speeds
   * that land on the same body are one choice, and printing it twice only
   * sends someone hunting for a difference the model does not have.
   */
  const options = useMemo(() => {
    if (!baseInput) return [];
    return distinctPaces(
      SPEEDS.map((value) => ({
        speed: value,
        result: simulatePlan({ ...baseInput, speed: value, targetWeightKg: null }),
      })),
    );
  }, [baseInput]);

  const chosen = useMemo(() => {
    if (!baseInput || !speed) return null;
    const target = targetWeightKg ?? suggestTargetWeight({ ...baseInput, speed });
    return { target, result: simulatePlan({ ...baseInput, speed, targetWeightKg: target }) };
  }, [baseInput, speed, targetWeightKg]);

  /**
   * You, drawn from the two numbers you just typed.
   *
   * Body fat is not asked for and not guessed at by the user — the model
   * assumes it from height and weight, and says so on the caption. It is a
   * proportion sketch, not a portrait, and it exists so that entering 82 kg
   * produces something other than the word "82".
   */
  const you = useMemo(() => {
    // Only once both numbers are inside believable bounds. Half-typed input
    // ("8" on the way to "82") would otherwise draw a body nobody has, and a
    // picture that flickers through nonsense is worse than no picture.
    if (!quickStartSchema.pick({ weightKg: true, heightCm: true }).safeParse({ weightKg, heightCm }).success) {
      return null;
    }
    if (weightKg === null || heightCm === null) return null;
    const input: BodyInput = {
      heightCm,
      weightKg,
      bodyFatPercent: null,
      sex: 'unspecified',
      wristCm: null,
      experience: DEFAULTS.experience,
    };
    const frame = frameSize(heightCm, null);
    return { input, frame, shape: bodyShape(analyseComposition(input), frame) };
  }, [weightKg, heightCm]);

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
    router.replace('/(tabs)/today');
  };

  return (
    <Screen ambient>
      {/* Three questions. The summary is the answer, not a fourth thing to
          get through, so it does not get a segment — and the bar no longer
          says "step 3 of 3" with a screen still to come. */}
      {step < 3 ? (
        <View style={styles.progress}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={[styles.progressStep, index <= step && styles.progressStepDone]} />
          ))}
        </View>
      ) : null}

      {step === 0 && (
        <Reveal>
          <Label style={styles.kicker}>Question 1 of 3</Label>
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
          <Label style={styles.kicker}>Question 2 of 3</Label>
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
          {/* The moment two numbers become a person. Nothing here is asked
              for twice — the drawing is made entirely of what is already on
              screen, which is exactly why it is worth showing. */}
          {you ? (
            <Reveal>
              <View style={styles.you}>
                <BodyRender shape={you.shape} height={200} caption="You, roughly" />
                <Text variant="caption" tone="tertiary" style={styles.youNote}>
                  Proportions estimated from your height and weight. It gets more accurate as you log
                  sessions, and you can measure yourself properly later.
                </Text>
              </View>
            </Reveal>
          ) : null}

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
          <Label style={styles.kicker}>Question 3 of 3</Label>
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
                    <SplitBar
                      leanKg={option.result.outcome.leanChangeKg}
                      fatKg={option.result.outcome.fatChangeKg}
                      style={styles.cardLine}
                    />
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
          <ActionBar>
            <PrimaryButton label="Continue" onPress={() => advance(3)} disabled={!speed} />
            <TextButton label="Back" onPress={() => advance(1)} style={styles.back} />
          </ActionBar>
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
            <PrimaryButton label="Start" onPress={finish} />
            <TextButton label="Back" onPress={() => advance(2)} style={styles.back} />
          </ActionBar>
        </>
      )}
    </Screen>
  );
}

/**
 * Muscle against fat, as one bar.
 *
 * The first version of this screen offered to draw the body each pace leads to,
 * side by side with the body you have now. Rendered, all four came out as the
 * same figure: twelve weeks of difference between a cautious pace and a hard
 * one is real, but it is not a difference a silhouette can carry, and four
 * near-identical drawings promise a distinction the picture cannot deliver.
 *
 * What *is* visible is the split. The fast paces put on more weight and a much
 * larger share of it is fat, and that is the entire decision being made on this
 * screen. One bar, two segments, widths in proportion — nobody has to hold
 * "1.7 kg lean, 3.2 kg fat" in their head to see that one of these is mostly
 * fat and the other is not.
 */
function SplitBar({ leanKg, fatKg, style }: { leanKg: number; fatKg: number; style?: ViewStyle }) {
  const lean = Math.abs(leanKg);
  const fat = Math.abs(fatKg);
  const total = lean + fat;
  if (total === 0) return null;

  return (
    <View style={style}>
      <View style={styles.split}>
        <View style={[styles.splitPart, { flex: lean, backgroundColor: colors.accent }]} />
        <View style={[styles.splitPart, { flex: fat, backgroundColor: colors.warning }]} />
      </View>
      <View style={styles.splitKey}>
        <Text variant="caption" tone="tertiary">
          {`${lean.toFixed(1)} kg muscle`}
        </Text>
        <Text variant="caption" tone="tertiary">
          {`${fat.toFixed(1)} kg fat`}
        </Text>
      </View>
    </View>
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
  you: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  youNote: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  split: {
    flexDirection: 'row',
    gap: 2,
    height: 8,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  splitPart: {
    height: '100%',
  },
  splitKey: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
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
