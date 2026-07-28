import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ActionBar, PrimaryButton, TextButton } from '@/components/Button';
import { Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { NumberInput } from '@/components/Input';
import { Scale } from '@/components/Scale';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { spacing } from '@/design-system/tokens';
import { useTodayCheckin } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { today as todayOf } from '@/utils/date';

/**
 * Daily check-in. Every field is optional — a partial check-in still improves
 * the recommendation, and the models report lower confidence rather than
 * refusing to run.
 */
export default function CheckinScreen() {
  const router = useRouter();
  const existing = useTodayCheckin();
  const saveCheckin = useAppStore((state) => state.saveCheckin);

  const [sleepHours, setSleepHours] = useState<number | null>(existing?.sleepHours ?? null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(existing?.sleepQuality ?? null);
  const [energy, setEnergy] = useState<number | null>(existing?.energy ?? null);
  const [soreness, setSoreness] = useState<number | null>(existing?.soreness ?? null);
  const [stress, setStress] = useState<number | null>(existing?.stress ?? null);
  const [motivation, setMotivation] = useState<number | null>(existing?.motivation ?? null);

  // Sleep that arrived from the watch is shown, not asked for. Overriding it
  // is one tap away, because the watch is wrong often enough to matter.
  const measuredSleep =
    existing?.sleepHours !== null && existing?.sleepHours !== undefined && existing.source !== 'manual';
  const [overrideSleep, setOverrideSleep] = useState(false);

  const save = () => {
    saveCheckin(todayOf(), { sleepHours, sleepQuality, energy, soreness, stress, motivation });
    router.back();
  };

  const anything =
    [sleepHours, sleepQuality, energy, soreness, stress, motivation].some((value) => value !== null);

  return (
    <Screen>
      <Header
        title={existing ? 'Edit check-in' : 'Morning check-in'}
        subtitle="Takes about twenty seconds"
        leading={{ icon: 'close', onPress: () => router.back(), label: 'Close' }}
      />

      <Section title="Sleep">
        {measuredSleep && !overrideSleep ? (
          <MetricRow
            label="Hours slept"
            value={`${sleepHours?.toFixed(1)} h`}
            accessory={<StatusPill label="From your watch" tone="info" />}
            onPress={() => setOverrideSleep(true)}
            style={styles.field}
          />
        ) : (
          <NumberInput
            label="Hours slept"
            value={sleepHours}
            onChange={setSleepHours}
            suffix="h"
            step={0.5}
            precision={1}
            placeholder="7.5"
            style={styles.field}
          />
        )}
        <Scale label="Sleep quality" value={sleepQuality} onChange={setSleepQuality} anchors={['Broken', 'Deep']} />
      </Section>

      <Section title="State">
        <Scale label="Energy" value={energy} onChange={setEnergy} anchors={['Drained', 'Fresh']} style={styles.field} />
        <Scale label="Soreness" value={soreness} onChange={setSoreness} anchors={['None', 'Severe']} style={styles.field} />
        <Scale label="Stress" value={stress} onChange={setStress} anchors={['Calm', 'High']} style={styles.field} />
        <Scale label="Motivation" value={motivation} onChange={setMotivation} anchors={['Low', 'High']} />
      </Section>

      <Note>
        Used for today&apos;s recommendation and the recovery part of Momentum. Nothing here leaves your device.
      </Note>

      <ActionBar>
        <PrimaryButton label="Save check-in" onPress={save} disabled={!anything} />
        <TextButton label="Cancel" onPress={() => router.back()} style={styles.cancel} />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.xl,
  },
  cancel: {
    alignSelf: 'center',
  },
});
