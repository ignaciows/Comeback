import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActionBar, PrimaryButton, TextButton } from '@/components/Button';
import { Input, NumberInput } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { Scale } from '@/components/Scale';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { exerciseName } from '@/data/exercises';
import { buildInitialRoutine, estimateRoutineDayMinutes, firstBlockObjective } from '@/data/routineTemplates';
import type { GoalType, TrainingLocation } from '@/domain/types';
import { useAppStore, type OnboardingPayload } from '@/store/useAppStore';
import { today, weekdayLabel } from '@/utils/date';
import {
  availabilitySchema,
  fieldErrors,
  initialStateSchema,
  startingPointSchema,
} from './schema';

type Draft = {
  goalType: GoalType | null;
  name: string;
  weightKg: number | null;
  heightCm: number | null;
  experience: 'beginner' | 'returning' | 'intermediate' | 'advanced' | null;
  layoffWeeks: number | null;
  recentFrequency: number | null;
  daysPerWeek: number | null;
  sessionMinutes: number | null;
  preferredWeekdays: number[];
  location: TrainingLocation | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  energy: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
  limitations: string;
  targetWeightKg: number | null;
  horizonWeeks: number | null;
};

const EMPTY: Draft = {
  goalType: null,
  name: '',
  weightKg: null,
  heightCm: null,
  experience: null,
  layoffWeeks: null,
  recentFrequency: null,
  daysPerWeek: null,
  sessionMinutes: 60,
  preferredWeekdays: [],
  location: 'gym',
  sleepHours: null,
  sleepQuality: null,
  energy: null,
  soreness: null,
  stress: null,
  motivation: null,
  limitations: '',
  targetWeightKg: null,
  horizonWeeks: 16,
};

const GOALS: { value: GoalType; label: string; detail: string }[] = [
  { value: 'regain_condition', label: 'Regain condition', detail: 'Get back to where you were' },
  { value: 'build_muscle', label: 'Build muscle', detail: 'Add size over time' },
  { value: 'lose_fat', label: 'Lose fat', detail: 'Keep strength while leaning out' },
  { value: 'recomposition', label: 'Recomposition', detail: 'Muscle up, fat down, weight steady' },
  { value: 'build_strength', label: 'Build strength', detail: 'Heavier main lifts' },
  { value: 'maintain', label: 'Maintain', detail: 'Hold what you have' },
];

const STEP_TITLES = ['Goal', 'Starting point', 'Availability', 'How you feel', 'Your first plan'];

export function OnboardingFlow() {
  const router = useRouter();
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };

  const previewRoutine = useMemo(() => {
    if (!draft.goalType || !draft.daysPerWeek) return null;
    return buildInitialRoutine({
      daysPerWeek: draft.daysPerWeek,
      sessionMinutes: draft.sessionMinutes ?? 60,
      location: draft.location ?? 'gym',
      goalType: draft.goalType,
      layoffWeeks: draft.layoffWeeks ?? 0,
    });
  }, [draft.goalType, draft.daysPerWeek, draft.sessionMinutes, draft.location, draft.layoffWeeks]);

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!draft.goalType) {
        setErrors({ goalType: 'Pick the goal that fits best' });
        return false;
      }
      return true;
    }
    if (step === 1) {
      const parsed = startingPointSchema.safeParse({
        name: draft.name,
        weightKg: draft.weightKg,
        heightCm: draft.heightCm,
        experience: draft.experience ?? undefined,
        layoffWeeks: draft.layoffWeeks ?? 0,
      });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return false;
      }
      return true;
    }
    if (step === 2) {
      const parsed = availabilitySchema.safeParse({
        daysPerWeek: draft.daysPerWeek,
        sessionMinutes: draft.sessionMinutes,
        preferredWeekdays: draft.preferredWeekdays,
        location: draft.location ?? undefined,
      });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return false;
      }
      return true;
    }
    if (step === 3) {
      const parsed = initialStateSchema.safeParse({
        sleepHours: draft.sleepHours,
        sleepQuality: draft.sleepQuality,
        energy: draft.energy,
        soreness: draft.soreness,
        stress: draft.stress,
        motivation: draft.motivation,
      });
      if (!parsed.success) {
        setErrors(fieldErrors(parsed.error));
        return false;
      }
      return true;
    }
    return true;
  };

  const next = () => {
    if (!validateStep()) return;
    if (step < STEP_TITLES.length - 1) {
      setStep(step + 1);
      return;
    }
    const payload: OnboardingPayload = {
      name: draft.name,
      heightCm: draft.heightCm as number,
      weightKg: draft.weightKg as number,
      experience: draft.experience ?? 'returning',
      layoffWeeks: draft.layoffWeeks ?? 0,
      goalType: draft.goalType as GoalType,
      targetWeightKg: draft.targetWeightKg,
      horizonWeeks: draft.horizonWeeks ?? 16,
      daysPerWeek: draft.daysPerWeek as number,
      sessionMinutes: draft.sessionMinutes ?? 60,
      preferredWeekdays: draft.preferredWeekdays.slice(0, draft.daysPerWeek as number),
      location: draft.location ?? 'gym',
      checkin: {
        sleepHours: draft.sleepHours,
        sleepQuality: draft.sleepQuality,
        energy: draft.energy,
        soreness: draft.soreness,
        stress: draft.stress,
        motivation: draft.motivation,
      },
      lastWorkoutDate: null,
      limitations: draft.limitations.trim() || null,
    };
    completeOnboarding(payload);
    router.replace('/(tabs)/today');
  };

  const toggleWeekday = (weekday: number) => {
    setErrors((current) => ({ ...current, preferredWeekdays: '' }));
    setDraft((current) => ({
      ...current,
      preferredWeekdays: current.preferredWeekdays.includes(weekday)
        ? current.preferredWeekdays.filter((day) => day !== weekday)
        : [...current.preferredWeekdays, weekday].sort(),
    }));
  };

  return (
    <Screen>
      <View style={styles.progress}>
        {STEP_TITLES.map((title, index) => (
          <View
            key={title}
            style={[styles.progressStep, index <= step && { backgroundColor: colors.accent }]}
          />
        ))}
      </View>
      <Label style={styles.stepLabel}>{`Step ${step + 1} of ${STEP_TITLES.length}`}</Label>

      {step === 0 && (
        <Section title="What are you working towards?" footnote="You can change this later without losing history.">
          <SegmentedControl
            options={GOALS}
            value={draft.goalType}
            onChange={(value) => update('goalType', value)}
            layout="list"
          />
          {errors.goalType ? (
            <Text variant="caption" tone="danger" style={styles.error}>
              {errors.goalType}
            </Text>
          ) : null}
        </Section>
      )}

      {step === 1 && (
        <>
          <Section title="Where you are now">
            <Input
              label="Name"
              value={draft.name}
              onChangeText={(value) => update('name', value)}
              placeholder="Ignacio"
              autoCapitalize="words"
              error={errors.name}
              style={styles.field}
            />
            <NumberInput
              label="Body weight"
              value={draft.weightKg}
              onChange={(value) => update('weightKg', value)}
              suffix="kg"
              step={0.25}
              precision={2}
              placeholder="77.25"
              error={errors.weightKg}
              style={styles.field}
            />
            <NumberInput
              label="Height"
              value={draft.heightCm}
              onChange={(value) => update('heightCm', value)}
              suffix="cm"
              step={1}
              precision={0}
              placeholder="186"
              error={errors.heightCm}
              style={styles.field}
            />
          </Section>
          <Section title="Training history">
            <SegmentedControl
              label="Experience"
              options={[
                { value: 'beginner', label: 'New to training' },
                { value: 'returning', label: 'Returning' },
                { value: 'intermediate', label: 'Intermediate' },
                { value: 'advanced', label: 'Advanced' },
              ]}
              value={draft.experience}
              onChange={(value) => update('experience', value)}
              layout="wrap"
              style={styles.field}
            />
            <NumberInput
              label="Weeks since you trained regularly"
              value={draft.layoffWeeks}
              onChange={(value) => update('layoffWeeks', value)}
              suffix="weeks"
              step={1}
              precision={0}
              placeholder="6"
              hint="0 if you never really stopped."
              error={errors.layoffWeeks}
              style={styles.field}
            />
            <NumberInput
              label="Sessions per week recently"
              value={draft.recentFrequency}
              onChange={(value) => update('recentFrequency', value)}
              suffix="/ week"
              step={1}
              precision={0}
              placeholder="1"
              style={styles.field}
            />
          </Section>
        </>
      )}

      {step === 2 && (
        <>
          <Section title="How often you can train">
            <SegmentedControl
              label="Days per week"
              options={[3, 4, 5, 6].map((value) => ({ value, label: `${value}` }))}
              value={draft.daysPerWeek}
              onChange={(value) => update('daysPerWeek', value)}
              style={styles.field}
            />
            {errors.daysPerWeek ? (
              <Text variant="caption" tone="danger" style={styles.error}>
                {errors.daysPerWeek}
              </Text>
            ) : null}
            <SegmentedControl
              label="Session length"
              options={[
                { value: 45, label: '45 min' },
                { value: 60, label: '60 min' },
                { value: 75, label: '75 min' },
                { value: 90, label: '90 min' },
              ]}
              value={draft.sessionMinutes}
              onChange={(value) => update('sessionMinutes', value)}
              style={styles.field}
            />
          </Section>
          <Section
            title="Preferred days"
            footnote="Used to build your schedule. Missing a day never deletes it — it can be moved."
          >
            <View style={styles.weekdays}>
              {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
                const selected = draft.preferredWeekdays.includes(weekday);
                return (
                  <Pressable
                    key={weekday}
                    onPress={() => toggleWeekday(weekday)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={({ pressed }) => [
                      styles.weekday,
                      selected && styles.weekdaySelected,
                      pressed && { opacity: opacity.pressed },
                    ]}
                  >
                    <Text variant="bodySmall" tone={selected ? 'primary' : 'tertiary'}>
                      {weekdayLabel(weekday).slice(0, 1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.preferredWeekdays ? (
              <Text variant="caption" tone="danger" style={styles.error}>
                {errors.preferredWeekdays}
              </Text>
            ) : null}
          </Section>
          <Section title="Where you train">
            <SegmentedControl
              options={[
                { value: 'gym', label: 'Gym' },
                { value: 'home', label: 'Home' },
              ]}
              value={draft.location}
              onChange={(value) => update('location', value)}
            />
          </Section>
        </>
      )}

      {step === 3 && (
        <>
          <Section title="Today" footnote="This becomes your first check-in and calibrates your baseline.">
            <NumberInput
              label="Sleep last night"
              value={draft.sleepHours}
              onChange={(value) => update('sleepHours', value)}
              suffix="h"
              step={0.5}
              precision={1}
              placeholder="7.5"
              error={errors.sleepHours}
              style={styles.field}
            />
            <Scale
              label="Sleep quality"
              value={draft.sleepQuality}
              onChange={(value) => update('sleepQuality', value)}
              anchors={['Broken', 'Deep']}
              style={styles.field}
            />
            <Scale
              label="Energy"
              value={draft.energy}
              onChange={(value) => update('energy', value)}
              anchors={['Drained', 'Fresh']}
              style={styles.field}
            />
            <Scale
              label="Soreness"
              value={draft.soreness}
              onChange={(value) => update('soreness', value)}
              anchors={['None', 'Severe']}
              style={styles.field}
            />
            <Scale
              label="Stress"
              value={draft.stress}
              onChange={(value) => update('stress', value)}
              anchors={['Calm', 'High']}
              style={styles.field}
            />
            <Scale
              label="Motivation"
              value={draft.motivation}
              onChange={(value) => update('motivation', value)}
              anchors={['Low', 'High']}
              style={styles.field}
            />
            {Object.values(errors).some(Boolean) ? (
              <Text variant="caption" tone="danger" style={styles.error}>
                Fill in every scale to continue.
              </Text>
            ) : null}
          </Section>
          <Section title="Anything bothering you?" footnote="Kept as a note. Comeback does not diagnose injuries.">
            <Input
              value={draft.limitations}
              onChangeText={(value) => update('limitations', value)}
              placeholder="Left shoulder on overhead work"
              multiline
            />
          </Section>
        </>
      )}

      {step === 4 && previewRoutine && (
        <>
          <Section title="Your first plan">
            <Text variant="title">{previewRoutine.name}</Text>
            <Text variant="bodySmall" tone="secondary" style={styles.planSubtitle}>
              {`${previewRoutine.daysPerWeek} days per week · about ${draft.sessionMinutes} minutes per session`}
            </Text>
          </Section>

          <Section title="Structure">
            {previewRoutine.days.map((day, index) => (
              <View key={day.id}>
                {index > 0 ? <Divider /> : null}
                <MetricRow
                  label={day.name}
                  detail={day.exercises.map((exercise) => exerciseName(exercise.exerciseId)).slice(0, 3).join(' · ')}
                  value={`${estimateRoutineDayMinutes(day)}m`}
                />
              </View>
            ))}
          </Section>

          <Section title="First session">
            <Text variant="body">{previewRoutine.days[0].name}</Text>
            <View style={styles.exerciseList}>
              {previewRoutine.days[0].exercises.map((exercise) => (
                <View key={exercise.id} style={styles.exerciseRow}>
                  <Text variant="bodySmall" tone="secondary">
                    {exerciseName(exercise.exerciseId)}
                  </Text>
                  <Text variant="bodySmall" tone="tertiary" mono>
                    {`${exercise.sets} × ${exercise.repMin}–${exercise.repMax}`}
                  </Text>
                </View>
              ))}
            </View>
          </Section>

          <Section title="Next two weeks">
            <Text variant="bodySmall" tone="secondary">
              {firstBlockObjective({
                daysPerWeek: draft.daysPerWeek as number,
                sessionMinutes: draft.sessionMinutes ?? 60,
                location: draft.location ?? 'gym',
                goalType: draft.goalType as GoalType,
                layoffWeeks: draft.layoffWeeks ?? 0,
              })}
            </Text>
          </Section>

          <Section title="Target">
            <MetricRow label="Goal" value={GOALS.find((goal) => goal.value === draft.goalType)?.label ?? ''} />
            <Divider />
            <MetricRow label="Starting from" value={today()} />
            <Divider />
            <MetricRow label="Horizon" value={`${draft.horizonWeeks} weeks`} />
          </Section>
        </>
      )}

      <ActionBar>
        <PrimaryButton label={step === STEP_TITLES.length - 1 ? 'Start' : 'Continue'} onPress={next} />
        {step > 0 ? <TextButton label="Back" onPress={() => setStep(step - 1)} style={styles.back} /> : null}
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  progressStep: {
    flex: 1,
    height: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  stepLabel: {
    marginBottom: spacing.xl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  error: {
    marginTop: spacing.sm,
  },
  weekdays: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  weekday: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  weekdaySelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  planSubtitle: {
    marginTop: spacing.xs,
  },
  exerciseList: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  back: {
    alignSelf: 'center',
  },
});
