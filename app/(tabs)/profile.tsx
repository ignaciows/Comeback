import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ConfirmationSheet } from '@/components/BottomSheet';
import { SecondaryButton } from '@/components/Button';
import { Note, StatusPill } from '@/components/Feedback';
import { Input, NumberInput } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { STRATEGIES } from '@/domain/plan/strategies';
import type { BiologicalSex, GoalType } from '@/domain/types';
import { PLANNED_HEALTH_SOURCES } from '@/services/health/HealthDataProvider';
import { useBodyWeightSeries } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { weekdayLabel } from '@/utils/date';

const GOAL_LABELS: Record<GoalType, string> = {
  regain_condition: 'Regain condition',
  build_muscle: 'Build muscle',
  lose_fat: 'Lose fat',
  recomposition: 'Recomposition',
  build_strength: 'Build strength',
  maintain: 'Maintain',
};

export default function ProfileScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const goal = useAppStore((state) => state.goal);
  const training = useAppStore((state) => state.training);
  const preferences = useAppStore((state) => state.preferences);
  const limitations = useAppStore((state) => state.limitations);
  const gyms = useAppStore((state) => state.gyms);

  const updateProfile = useAppStore((state) => state.updateProfile);
  const updateGoal = useAppStore((state) => state.updateGoal);
  const updateTraining = useAppStore((state) => state.updateTraining);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const setLimitations = useAppStore((state) => state.setLimitations);
  const regenerateRoutine = useAppStore((state) => state.regenerateRoutine);
  const seedDeveloperProfile = useAppStore((state) => state.seedDeveloperProfile);
  const resetAll = useAppStore((state) => state.resetAll);

  const weights = useBodyWeightSeries();
  const latestWeight = weights[weights.length - 1] ?? null;

  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [confirmSeed, setConfirmSeed] = useState(false);

  const gym = gyms.find((entry) => entry.id === training.gymId) ?? gyms[0] ?? null;

  return (
    <Screen>
      <Text variant="title" style={styles.title}>
        Profile
      </Text>

      <Section title="You">
        <Input
          label="Name"
          value={profile?.name ?? ''}
          onChangeText={(value) => updateProfile({ name: value })}
          style={styles.field}
        />
        <NumberInput
          label="Height"
          value={profile?.heightCm ?? null}
          onChange={(value) => value !== null && updateProfile({ heightCm: value })}
          suffix="cm"
          precision={0}
          style={styles.field}
        />
        <MetricRow
          label="Body weight"
          value={latestWeight ? `${latestWeight.weightKg.toFixed(2)} kg` : 'Not logged'}
          detail="Logged from Progress or Today"
          onPress={() => router.push('/log-weight')}
        />
        <Divider />
        <NumberInput
          label="Age"
          value={profile?.age ?? null}
          onChange={(value) => updateProfile({ age: value })}
          suffix="years"
          precision={0}
          hint="Only used for the calorie estimate; 30 is assumed when empty."
          style={styles.fieldTop}
        />
        <SegmentedControl
          label="Sex"
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'unspecified', label: 'Not set' },
          ]}
          value={profile?.sex ?? 'unspecified'}
          onChange={(value: BiologicalSex) => updateProfile({ sex: value })}
          style={styles.field}
        />
      </Section>

      <Section title="Plan">
        <MetricRow
          label={goal ? STRATEGIES[goal.strategy].label : 'No plan yet'}
          detail="Change strategy, target and see what it costs in days"
          onPress={() => router.push('/plan')}
        />
        <Divider />
        <MetricRow
          label="Method"
          detail="The findings the plans are built from, and their sources"
          onPress={() => router.push('/method')}
        />
      </Section>

      <Section title="Goal">
        <SegmentedControl
          options={(Object.keys(GOAL_LABELS) as GoalType[]).map((value) => ({
            value,
            label: GOAL_LABELS[value],
          }))}
          value={goal?.type ?? null}
          onChange={(value) => updateGoal({ type: value })}
          layout="wrap"
          style={styles.field}
        />
        <NumberInput
          label="Target weight"
          value={goal?.targetWeightKg ?? null}
          onChange={(value) => updateGoal({ targetWeightKg: value })}
          suffix="kg"
          step={0.5}
          precision={1}
          style={styles.field}
        />
        <NumberInput
          label="Daily protein target"
          value={goal?.proteinTargetG ?? null}
          onChange={(value) => updateGoal({ proteinTargetG: value })}
          suffix="g"
          step={5}
          precision={0}
          hint="Recorded as a reference. Comeback does not track your food."
          style={styles.field}
        />
        <NumberInput
          label="Horizon"
          value={goal?.horizonWeeks ?? null}
          onChange={(value) => value !== null && updateGoal({ horizonWeeks: value })}
          suffix="weeks"
          step={1}
          precision={0}
          hint="Drives the estimated target date."
        />
      </Section>

      <Section title="Schedule" footnote="Changing these rebuilds future planned days; past history is untouched.">
        <SegmentedControl
          label="Days per week"
          options={[3, 4, 5, 6].map((value) => ({ value, label: `${value}` }))}
          value={training.preferredDaysPerWeek}
          onChange={(value) => updateTraining({ preferredDaysPerWeek: value })}
          style={styles.field}
        />
        <SegmentedControl
          label="Session length"
          options={[45, 60, 75, 90].map((value) => ({ value, label: `${value}m` }))}
          value={training.sessionMinutes}
          onChange={(value) => updateTraining({ sessionMinutes: value })}
          style={styles.field}
        />
        <MetricRow
          label="Training days"
          value={training.preferredWeekdays.map((day) => weekdayLabel(day)).join(' ')}
        />
        <Divider />
        <SegmentedControl
          label="Where you train"
          options={[
            { value: 'gym', label: 'Gym' },
            { value: 'home', label: 'Home' },
          ]}
          value={training.location}
          onChange={(value) => updateTraining({ location: value })}
          style={styles.fieldTop}
        />
      </Section>

      <Section title="Routine">
        <MetricRow
          label="Rebuild routine"
          detail="Generates a fresh routine from your current goal and schedule"
          onPress={() => setConfirmRegenerate(true)}
        />
      </Section>

      <Section title="Gym">
        <MetricRow
          label={gym?.name ?? 'No gym yet'}
          detail={
            gym
              ? `${Object.values(gym.equipment).filter((value) => value === 'available').length} categories confirmed`
              : 'Add the equipment you have access to'
          }
          onPress={() => router.push('/gym')}
        />
      </Section>

      <Section title="Data sources" footnote="Health data stays on this device until you connect a source yourself.">
        <MetricRow label="Manual entry" value="Active" detail="Check-ins and body weight" />
        {PLANNED_HEALTH_SOURCES.map((source) => (
          <View key={source.id}>
            <Divider />
            <MetricRow
              label={source.label}
              detail={source.note}
              accessory={<StatusPill label="Not connected" tone="neutral" />}
            />
          </View>
        ))}
      </Section>

      <Section title="Preferences">
        <SegmentedControl
          label="Units"
          options={[
            { value: 'metric', label: 'kg / cm' },
            { value: 'imperial', label: 'lb / in' },
          ]}
          value={preferences.units}
          onChange={(value) => updatePreferences({ units: value })}
          style={styles.field}
        />
        {preferences.units === 'imperial' ? (
          <Note style={styles.field}>
            Imperial display is not implemented yet — values are still stored and shown in kilograms.
          </Note>
        ) : null}
        <NumberInput
          label="Default rest"
          value={preferences.defaultRestSeconds}
          onChange={(value) => value !== null && updatePreferences({ defaultRestSeconds: value })}
          suffix="s"
          step={15}
          precision={0}
        />
      </Section>

      <Section title="Notes">
        <Input
          label="Limitations"
          value={limitations ?? ''}
          onChangeText={(value) => setLimitations(value || null)}
          placeholder="Anything to work around"
          multiline
        />
      </Section>

      <Section title="Data">
        <SecondaryButton label="Load sample history" onPress={() => setConfirmSeed(true)} style={styles.field} />
        <Note style={styles.field}>
          Development seed: writes the starting profile plus four weeks of history so the models have data to work
          with. Everything it creates is editable and behaves like anything you log yourself.
        </Note>
        <SecondaryButton label="Delete all data" tone="danger" onPress={() => setConfirmReset(true)} />
      </Section>

      <ConfirmationSheet
        visible={confirmRegenerate}
        onClose={() => setConfirmRegenerate(false)}
        title="Rebuild routine"
        message="A new routine is generated from your current goal and schedule. Logged sessions are kept."
        confirmLabel="Rebuild"
        onConfirm={regenerateRoutine}
      />

      <ConfirmationSheet
        visible={confirmSeed}
        onClose={() => setConfirmSeed(false)}
        title="Load sample history"
        message="This replaces your current sessions with four weeks of generated history. Use it to see how the models behave."
        confirmLabel="Load"
        onConfirm={seedDeveloperProfile}
      />

      <ConfirmationSheet
        visible={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Delete all data"
        message="Everything is removed from this device: profile, sessions, check-ins and body weight. This cannot be undone."
        confirmLabel="Delete everything"
        destructive
        onConfirm={() => {
          resetAll();
          router.replace('/onboarding');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: spacing.xxl,
  },
  field: {
    marginBottom: spacing.lg,
  },
  fieldTop: {
    marginTop: spacing.lg,
  },
});
