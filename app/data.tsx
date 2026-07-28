import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ConfirmationSheet } from '@/components/BottomSheet';
import { SecondaryButton } from '@/components/Button';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { spacing } from '@/design-system/tokens';
import { useBodyWeightSeries, useCompletedSessions } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';

/** What is stored, and the two destructive actions, kept away from daily use. */
export default function DataScreen() {
  const router = useRouter();
  const sessions = useCompletedSessions();
  const weights = useBodyWeightSeries();
  const checkins = useAppStore((state) => state.checkins);
  const seedDeveloperProfile = useAppStore((state) => state.seedDeveloperProfile);
  const resetAll = useAppStore((state) => state.resetAll);

  const [confirmSeed, setConfirmSeed] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <Screen>
      <Header title="Your data" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />

      <Section title="Stored on this device">
        <MetricRow label="Sessions" value={`${sessions.length}`} />
        <Divider />
        <MetricRow label="Check-ins" value={`${checkins.length}`} />
        <Divider />
        <MetricRow label="Weight entries" value={`${weights.length}`} />
      </Section>

      <Section title="Sample history">
        <Note style={styles.note}>
        Four weeks of generated sessions, so the models have something to show. Replaces what you have now.
      </Note>
        <SecondaryButton label="Load sample history" onPress={() => setConfirmSeed(true)} />
      </Section>

      <Section title="Delete">
        <SecondaryButton label="Delete all data" tone="danger" onPress={() => setConfirmReset(true)} />
      </Section>

      <ConfirmationSheet
        visible={confirmSeed}
        onClose={() => setConfirmSeed(false)}
        title="Load sample history"
        message="This replaces your current sessions with four weeks of generated history."
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
  note: {
    marginBottom: spacing.lg,
  },
});
