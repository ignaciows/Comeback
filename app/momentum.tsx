import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/Chart';
import { EmptyState, Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { momentumConfig } from '@/domain/config';
import { momentumStateLabel } from '@/domain/momentum/calculateMomentum';
import type { MomentumComponents } from '@/domain/types';
import { MomentumRing } from '@/features/momentum/MomentumRing';
import { useEngine } from '@/store/hooks';
import { formatShortDate } from '@/utils/date';

const COMPONENT_LABELS: Record<keyof MomentumComponents, string> = {
  adherence: 'Plan adherence',
  consistency: 'Recent consistency',
  progression: 'Performance progression',
  recovery: 'Recovery',
  logging: 'Logging regularity',
};

const COMPONENT_HELP: Record<keyof MomentumComponents, string> = {
  adherence: 'Planned sessions you completed. Rescheduled costs less than skipped; planned rest costs nothing.',
  consistency: 'Sessions in the last 7 and 28 days against your target, plus unbroken weeks.',
  progression: 'Estimated 1RM on repeated exercises and average session volume, recent window versus the previous one.',
  recovery: 'Your check-ins over the last week: sleep, energy, soreness, stress.',
  logging: 'How completely you are feeding the model. Low logging lowers confidence, not fitness.',
};

export default function MomentumScreen() {
  const router = useRouter();
  const engine = useEngine();
  const { momentum, momentumSeries } = engine;

  if (!momentum) {
    return (
      <Screen>
        <Header title="Momentum" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState
          title="Not enough data yet"
          description="Momentum is calculated from logged sessions, planned days and check-ins. Log one of them and it starts."
        />
      </Screen>
    );
  }

  const points = momentumSeries.slice(-56).map((snapshot) => ({ x: snapshot.date, y: snapshot.score }));
  const recentChanges = [...momentumSeries]
    .reverse()
    .filter((snapshot) => Math.abs(snapshot.delta) >= 0.1)
    .slice(0, 12);

  return (
    <Screen>
      <Header
        title="Momentum"
        subtitle={momentumStateLabel(momentum.state)}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Section>
        <MomentumRing
          score={momentum.score}
          color={
            momentum.state === 'at_risk'
              ? colors.warning
              : momentum.state === 'declining'
                ? colors.danger
                : momentum.state === 'recovering'
                  ? colors.info
                  : momentum.state === 'stable'
                    ? colors.textSecondary
                    : colors.accent
          }
          label={momentumStateLabel(momentum.state)}
        />
        <Text variant="bodySmall" tone="secondary" style={styles.explanation}>
          {momentum.explanation}
        </Text>
        <View style={styles.summaryRow}>
          <Text variant="caption" tone="tertiary">
            {`${momentum.confidence} confidence`}
          </Text>
          <Text variant="caption" tone="tertiary" mono>
            {engine.momentumDelta7 === null
              ? 'No 7-day trend yet'
              : `${engine.momentumDelta7 > 0 ? '+' : ''}${engine.momentumDelta7} over 7 days`}
          </Text>
        </View>
      </Section>

      <Section title="History" footnote="One point per day since your first logged data.">
        <LineChart
          points={points}
          domain={[0, 100]}
          xLabels={points.length > 1 ? [formatShortDate(points[0].x), 'Today'] : undefined}
        />
      </Section>

      <Section title="What it is made of">
        {(Object.keys(COMPONENT_LABELS) as (keyof MomentumComponents)[]).map((key) => {
          const value = momentum.components[key];
          const weight = Math.round(momentumConfig.weights[key] * 100);
          return (
            <View key={key} style={styles.component}>
              <View style={styles.componentHead}>
                <Text variant="body">{COMPONENT_LABELS[key]}</Text>
                <Text variant="bodySmall" tone="secondary" mono>
                  {value === null ? 'No data' : `${Math.round(value)}`}
                </Text>
              </View>
              <ProgressBar
                value={value === null ? 0 : value / 100}
                color={value === null ? colors.border : colors.accent}
                label={COMPONENT_LABELS[key]}
              />
              <Text variant="caption" tone="tertiary" style={styles.componentHelp}>
                {`${weight}% of the score · ${COMPONENT_HELP[key]}`}
              </Text>
            </View>
          );
        })}
        <Note style={styles.note}>
          Components without data are dropped and their weight is shared across the rest, so a missing signal never
          reads as a zero.
        </Note>
      </Section>

      <Section title="Today's factors">
        {momentum.factors.map((factor, index) => (
          <View key={factor.key}>
            {index > 0 ? <Divider /> : null}
            <View style={styles.factor}>
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
              <View style={styles.factorText}>
                <Text variant="bodySmall">{factor.label}</Text>
                <Text variant="caption" tone="tertiary">
                  {factor.detail}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </Section>

      <Section title="Recent changes" footnote="Every update keeps its previous score, its new score and why it moved.">
        {recentChanges.length === 0 ? (
          <Text variant="bodySmall" tone="secondary">
            Momentum has not moved yet.
          </Text>
        ) : (
          recentChanges.map((snapshot, index) => (
            <View key={snapshot.date}>
              {index > 0 ? <Divider /> : null}
              <MetricRow
                label={formatShortDate(snapshot.date)}
                detail={snapshot.explanation}
                value={`${snapshot.delta > 0 ? '+' : ''}${snapshot.delta}`}
              />
            </View>
          ))
        )}
      </Section>

      <Section title="How the states work">
        {momentumConfig.states.map((band, index) => {
          const next = momentumConfig.states[index + 1];
          return (
            <View key={band.id}>
              {index > 0 ? <Divider /> : null}
              <MetricRow label={band.label} value={`${band.min}–${next ? next.min - 1 : 100}`} />
            </View>
          );
        })}
        <Note style={styles.note}>
          A score below {momentumConfig.recovering.maxScore} that is climbing is reported as Recovering rather than At
          risk.
        </Note>
      </Section>

      <Label style={styles.footer}>Momentum is a Comeback metric, not a measurement</Label>
    </Screen>
  );
}

const styles = StyleSheet.create({
  explanation: {
    marginTop: spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  component: {
    marginBottom: spacing.xl,
  },
  componentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  componentHelp: {
    marginTop: spacing.sm,
  },
  note: {
    marginTop: spacing.md,
  },
  factor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  factorText: {
    flex: 1,
    gap: 2,
  },
  footer: {
    marginTop: spacing.xl,
  },
});
