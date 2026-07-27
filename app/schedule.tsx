import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ConfirmationSheet } from '@/components/BottomSheet';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { NumberInput } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { useAppStore } from '@/store/useAppStore';
import { weekdayLabel } from '@/utils/date';

/** When and where you train. Changing it rebuilds the future plan. */
export default function ScheduleScreen() {
  const router = useRouter();
  const training = useAppStore((state) => state.training);
  const preferences = useAppStore((state) => state.preferences);
  const updateTraining = useAppStore((state) => state.updateTraining);
  const updatePreferences = useAppStore((state) => state.updatePreferences);
  const regenerateRoutine = useAppStore((state) => state.regenerateRoutine);

  const [confirmRebuild, setConfirmRebuild] = useState(false);

  const toggleWeekday = (weekday: number) => {
    const next = training.preferredWeekdays.includes(weekday)
      ? training.preferredWeekdays.filter((day) => day !== weekday)
      : [...training.preferredWeekdays, weekday].sort();
    if (next.length === 0) return;
    updateTraining({ preferredWeekdays: next });
  };

  return (
    <Screen>
      <Header
        title="Schedule"
        subtitle={`${training.preferredDaysPerWeek} days a week`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Section title="Days per week">
        <SegmentedControl
          options={[3, 4, 5, 6].map((value) => ({ value, label: `${value}` }))}
          value={training.preferredDaysPerWeek}
          onChange={(value) => updateTraining({ preferredDaysPerWeek: value })}
        />
      </Section>

      <Section title="Which days">
        <View style={styles.weekdays}>
          {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
            const selected = training.preferredWeekdays.includes(weekday);
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
      </Section>

      <Section title="Session length">
        <SegmentedControl
          options={[45, 60, 75, 90].map((value) => ({ value, label: `${value}m` }))}
          value={training.sessionMinutes}
          onChange={(value) => updateTraining({ sessionMinutes: value })}
        />
      </Section>

      <Section title="Where">
        <SegmentedControl
          options={[
            { value: 'gym', label: 'Gym' },
            { value: 'home', label: 'Home' },
          ]}
          value={training.location}
          onChange={(value) => updateTraining({ location: value })}
        />
      </Section>

      <Section title="Rest between sets">
        <NumberInput
          value={preferences.defaultRestSeconds}
          onChange={(value) => value !== null && updatePreferences({ defaultRestSeconds: value })}
          suffix="s"
          step={15}
          precision={0}
        />
      </Section>

      <Section>
        <MetricRow
          label="Rebuild routine"
          detail="Generate a fresh routine from this schedule"
          onPress={() => setConfirmRebuild(true)}
        />
      </Section>

      <Note>
        Changes apply to days that have not happened yet. Sessions you already logged are never touched.
      </Note>

      <ConfirmationSheet
        visible={confirmRebuild}
        onClose={() => setConfirmRebuild(false)}
        title="Rebuild routine"
        message="A new routine is generated from your current goal and schedule. Logged sessions are kept."
        confirmLabel="Rebuild"
        onConfirm={regenerateRoutine}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
});
