import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PrimaryButton } from '@/components/Button';
import { Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { appleHealthStatus, createAppleHealthDataProvider } from '@/services/health/AppleHealthDataProvider';
import { syncHealthData } from '@/services/health/sync';
import { useAppStore } from '@/store/useAppStore';

/**
 * Where the app's data comes from.
 *
 * Apple Health is the transport for both the Watch and Renpho: the scale writes
 * body weight and body fat into Health, the Watch writes sleep, heart rate and
 * workouts, and Comeback reads from there. One connection covers both.
 */
export default function SourcesScreen() {
  const router = useRouter();
  const bodyMeasurements = useAppStore((state) => state.bodyMeasurements);
  const checkins = useAppStore((state) => state.checkins);
  const applyHealthSync = useAppStore((state) => state.applyHealthSync);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const status = appleHealthStatus();
  const imported = bodyMeasurements.filter((entry) => entry.source !== 'manual').length;

  const connect = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const provider = createAppleHealthDataProvider();
      const available = await provider.isAvailable();
      if (!available) {
        setMessage(
          'Apple Health is not reachable from this build. It needs a development build of Comeback — Expo Go cannot access HealthKit.',
        );
        return;
      }

      const granted = await provider.requestPermissions();
      if (!granted) {
        setMessage('Permission was declined in the Health app.');
        return;
      }

      const result = await syncHealthData({
        provider,
        existingWeights: bodyMeasurements,
        existingCheckins: checkins,
        days: 60,
      });
      applyHealthSync(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage(
        result.imported === 0
          ? 'Connected. Nothing new to import — everything is already up to date.'
          : `Imported ${result.imported} values${result.skipped > 0 ? `, kept ${result.skipped} of your own` : ''}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read from Apple Health');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Data sources" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />

      <Reveal index={0}>
        <Section title="Sources">
          <MetricRow label="Manual entry" value="Active" detail="Check-ins and body weight you type yourself" />
          <Divider />
          <MetricRow
            label="Apple Health"
            detail="Sleep, steps, heart rate, HRV, workouts — and Renpho weight through it"
            accessory={
              <StatusPill
                label={status === 'ready' ? 'Available' : 'Needs a build'}
                tone={status === 'ready' ? 'accent' : 'warning'}
              />
            }
          />
          {imported > 0 ? (
            <>
              <Divider />
              <MetricRow label="Imported values" value={`${imported}`} />
            </>
          ) : null}
        </Section>
      </Reveal>

      <Reveal index={1}>
        <Section title="Import">
          <PrimaryButton
            label={busy ? 'Reading Apple Health' : 'Connect Apple Health'}
            loading={busy}
            onPress={() => void connect()}
          />
          {message ? (
            <Text variant="bodySmall" tone="secondary" style={styles.message}>
              {message}
            </Text>
          ) : null}
        </Section>
      </Reveal>

      {status === 'needs_build' ? (
        <Reveal index={2}>
          <Section title="Why it is not on yet">
            <Text variant="bodySmall" tone="secondary">
              HealthKit is native code. Expo Go — what you are running this in — only contains the modules Expo ships
              with, so it cannot read Health whatever the code says. A development build of Comeback, installed on
              your phone, can. The reading, mapping and import logic is already written; what is missing is the build.
            </Text>
            <Text variant="bodySmall" tone="secondary" style={styles.paragraph}>
              Building for a physical iPhone needs an Apple Developer account to sign the app. After that it is one
              command.
            </Text>
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={3}>
        <Section title="Renpho">
          <Text variant="bodySmall" tone="secondary">
            Renpho does not need its own connection. Turn on Apple Health syncing inside the Renpho app and your
            weight and body fat arrive here with everything else — tagged as coming from the scale, and still
            editable.
          </Text>
        </Section>
      </Reveal>

      <Note>
        Nothing is uploaded. A value you typed is never overwritten, and importing twice changes nothing.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    marginTop: spacing.lg,
  },
  paragraph: {
    marginTop: spacing.md,
  },
});
