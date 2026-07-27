import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { PLANNED_HEALTH_SOURCES } from '@/services/health/HealthDataProvider';

/** Where the app's data comes from, and what is not connected yet. */
export default function SourcesScreen() {
  const router = useRouter();

  return (
    <Screen>
      <Header
        title="Data sources"
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Section>
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

      <Note>
        Nothing leaves this device. When a source is connected, imported values keep their origin and stay editable.
      </Note>
    </Screen>
  );
}
