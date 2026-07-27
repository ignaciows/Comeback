import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Input, NumberInput } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { spacing } from '@/design-system/tokens';
import type { BiologicalSex, ExperienceLevel } from '@/domain/types';
import { useBodyWeightSeries } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';

/** Personal data. Only what the models actually use. */
export default function YouScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const limitations = useAppStore((state) => state.limitations);
  const preferences = useAppStore((state) => state.preferences);
  const updateProfile = useAppStore((state) => state.updateProfile);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const setLimitations = useAppStore((state) => state.setLimitations);

  const weights = useBodyWeightSeries();
  const latest = weights[weights.length - 1] ?? null;

  return (
    <Screen>
      <Header title="You" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />

      <Section>
        <Input
          label="Name"
          value={profile?.name ?? ''}
          onChangeText={(value) => updateProfile({ name: value })}
          placeholder="Your name"
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
          value={latest ? `${latest.weightKg.toFixed(2)} kg` : 'Not logged'}
          onPress={() => router.push('/body')}
        />
      </Section>

      <Section title="Training age" footnote="Sets how fast the plan assumes you can add muscle.">
        <SegmentedControl
          options={[
            { value: 'beginner', label: 'New' },
            { value: 'returning', label: 'Returning' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
          ]}
          value={profile?.experience ?? null}
          onChange={(value: ExperienceLevel) => updateProfile({ experience: value })}
          layout="wrap"
        />
      </Section>

      <Section title="For the calorie estimate" footnote="Only used for that. 30 and unspecified are assumed when empty.">
        <NumberInput
          label="Age"
          value={profile?.age ?? null}
          onChange={(value) => updateProfile({ age: value })}
          suffix="years"
          precision={0}
          style={styles.field}
        />
        <SegmentedControl
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'unspecified', label: 'Not set' },
          ]}
          value={profile?.sex ?? 'unspecified'}
          onChange={(value: BiologicalSex) => updateProfile({ sex: value })}
        />
      </Section>

      <Section title="Anything to work around" footnote="Kept as a note. Comeback does not diagnose injuries.">
        <Input
          value={limitations ?? ''}
          onChangeText={(value) => setLimitations(value || null)}
          placeholder="Left shoulder on overhead work"
          multiline
        />
      </Section>

      <Section title="Units">
        <SegmentedControl
          options={[
            { value: 'metric', label: 'kg / cm' },
            { value: 'imperial', label: 'lb / in' },
          ]}
          value={preferences.units}
          onChange={(value) => updatePreferences({ units: value })}
        />
        {preferences.units === 'imperial' ? (
          <Note style={styles.note}>
            Imperial display is not implemented yet — values are still stored and shown in kilograms.
          </Note>
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.lg,
  },
  note: {
    marginTop: spacing.lg,
  },
});
