import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { PROJECTION_CAVEAT, TRAINING_PRINCIPLES } from '@/data/trainingPrinciples';

/**
 * What the app believes and why. Every rule here is applied somewhere in the
 * product, and says where it is applied — no principle is decoration.
 */
export default function MethodScreen() {
  const router = useRouter();

  return (
    <Screen>
      <Header
        title="Method"
        subtitle="What the plans are built from"
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Note>
        Comeback applies a small number of well-supported findings and tells you which one it is applying. Nothing
        here is a personal prescription, and none of it is medical advice.
      </Note>

      <View style={styles.list}>
        {TRAINING_PRINCIPLES.map((principle, index) => (
          <Reveal key={principle.id} index={index}>
            <Section>
              <Text variant="heading">{principle.title}</Text>
              <Text variant="bodySmall" tone="secondary" style={styles.detail}>
                {principle.detail}
              </Text>
              <Label style={styles.label}>In the app</Label>
              <Text variant="bodySmall" tone="secondary">
                {principle.application}
              </Text>
              <Text variant="caption" tone="tertiary" style={styles.source}>
                {principle.source}
              </Text>
            </Section>
          </Reveal>
        ))}
      </View>

      <Note>{PROJECTION_CAVEAT}</Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: spacing.xl,
  },
  detail: {
    marginTop: spacing.sm,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  source: {
    marginTop: spacing.md,
  },
});
