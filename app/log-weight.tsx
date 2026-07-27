import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActionBar, PrimaryButton, TextButton } from '@/components/Button';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { NumberInput } from '@/components/Input';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { spacing } from '@/design-system/tokens';
import { useBodyWeightSeries } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { formatShortDate, today as todayOf } from '@/utils/date';

export default function LogWeightScreen() {
  const router = useRouter();
  const measurements = useBodyWeightSeries();
  const logBodyWeight = useAppStore((state) => state.logBodyWeight);
  const deleteBodyMeasurement = useAppStore((state) => state.deleteBodyMeasurement);

  const date = todayOf();
  const todayEntry = measurements.find((entry) => entry.date === date);
  const latest = measurements[measurements.length - 1];
  const [weight, setWeight] = useState<number | null>(todayEntry?.weightKg ?? latest?.weightKg ?? null);

  const save = () => {
    if (weight === null) return;
    logBodyWeight(weight, date, 'manual');
    router.back();
  };

  return (
    <Screen>
      <Header
        title="Body weight"
        subtitle={formatShortDate(date)}
        leading={{ icon: 'close', onPress: () => router.back(), label: 'Close' }}
      />

      <Section>
        <NumberInput
          label="Weight"
          value={weight}
          onChange={setWeight}
          suffix="kg"
          step={0.05}
          precision={2}
          placeholder="77.25"
        />
      </Section>

      <Note>
        Logged manually today. When Renpho or Apple Health is connected, imported values appear here with their source
        and stay editable.
      </Note>

      {measurements.length > 0 ? (
        <Section title="Recent entries" style={styles.recent}>
          {[...measurements]
            .reverse()
            .slice(0, 8)
            .map((entry, index) => (
              <View key={entry.id}>
                {index > 0 ? <Divider /> : null}
                <MetricRow
                  label={formatShortDate(entry.date)}
                  detail={entry.source === 'manual' ? 'Manual' : entry.source}
                  value={`${entry.weightKg.toFixed(2)} kg`}
                  onPress={() => deleteBodyMeasurement(entry.id)}
                />
              </View>
            ))}
          <Note style={styles.hint}>Tap an entry to remove it.</Note>
        </Section>
      ) : null}

      <ActionBar>
        <PrimaryButton label="Save" onPress={save} disabled={weight === null} />
        <TextButton label="Cancel" onPress={() => router.back()} style={styles.cancel} />
      </ActionBar>
    </Screen>
  );
}

const styles = StyleSheet.create({
  recent: {
    marginTop: spacing.xxl,
  },
  hint: {
    marginTop: spacing.md,
  },
  cancel: {
    alignSelf: 'center',
  },
});
