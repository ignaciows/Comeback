import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { useEngine } from '@/store/hooks';

/**
 * The reasoning behind today's recommendation, one level below Today. Kept off
 * the main screen on purpose: it matters when you disagree with the app, not
 * every morning.
 */
export default function WhyScreen() {
  const router = useRouter();
  const { recommendation, week } = useEngine();

  return (
    <Screen>
      <Header
        title="Why this session"
        subtitle={recommendation.title}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <Section>
          <Text variant="body">{recommendation.reason}</Text>
        </Section>
      </Reveal>

      <Reveal index={1}>
        <Section title="What it looked at">
          {recommendation.factors.map((factor) => (
            <View key={factor.key} style={styles.factor}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      factor.direction === 'positive'
                        ? colors.accent
                        : factor.direction === 'negative'
                          ? colors.warning
                          : colors.borderStrong,
                  },
                ]}
              />
              <Text variant="bodySmall" tone="secondary" style={styles.factorText}>
                {factor.label}
              </Text>
            </View>
          ))}
        </Section>
      </Reveal>

      <Reveal index={2}>
        <NavGroup>
          <NavRow
            label="This week"
            value={`${week.completed} of ${week.target}`}
            onPress={() => router.push('/consistency')}
          />
          <NavRow label="How the app decides" onPress={() => router.push('/method')} />
        </NavGroup>
      </Reveal>

      <Note style={styles.note}>
        {`Confidence: ${recommendation.confidence}. Recommendations are guidance, not instructions — you can always train anyway.`}
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  factor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  factorText: {
    flex: 1,
  },
  note: {
    marginTop: spacing.xl,
  },
});
