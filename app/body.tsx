import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/Button';
import { LineChart } from '@/components/Chart';
import { EmptyState } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Metric, MetricRow } from '@/components/Metric';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { colors, spacing } from '@/design-system/tokens';
import { useBodyWeightSeries, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { daysBetween, formatShortDate } from '@/utils/date';
import { mean, round } from '@/utils/math';

/** Body weight: the number, the trend, the entries. */
export default function BodyScreen() {
  const router = useRouter();
  const weights = useBodyWeightSeries();
  const engine = useEngine();
  const goal = useAppStore((state) => state.goal);

  const points = useMemo(() => weights.map((entry) => ({ x: entry.date, y: entry.weightKg })), [weights]);

  // Seven-entry trailing mean: day-to-day weight is mostly noise.
  const average = useMemo(
    () =>
      points.map((point, index) => ({
        x: point.x,
        y: round(mean(points.slice(Math.max(0, index - 6), index + 1).map((entry) => entry.y)), 2),
      })),
    [points],
  );

  const weeklyChange = useMemo(() => {
    if (weights.length < 2) return null;
    const latest = weights[weights.length - 1];
    const reference = [...weights].reverse().find((entry) => daysBetween(entry.date, latest.date) >= 7);
    if (!reference) return null;
    const days = daysBetween(reference.date, latest.date) || 1;
    return round(((latest.weightKg - reference.weightKg) / days) * 7, 2);
  }, [weights]);

  const latest = weights[weights.length - 1] ?? null;

  return (
    <Screen>
      <Header
        title="Body weight"
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {weights.length === 0 ? (
        <EmptyState
          title="No weight logged"
          description="One entry a week is enough for the trend to mean something."
          action={{ label: 'Log weight', onPress: () => router.push('/log-weight') }}
        />
      ) : (
        <>
          <Reveal index={0}>
            <Section>
              <View style={styles.metrics}>
                <Metric
                  label="Current"
                  value={(latest as NonNullable<typeof latest>).weightKg.toFixed(2)}
                  unit="kg"
                  caption={formatShortDate((latest as NonNullable<typeof latest>).date)}
                />
                <Metric
                  label="Per week"
                  value={weeklyChange === null ? '—' : `${weeklyChange > 0 ? '+' : ''}${weeklyChange}`}
                  unit={weeklyChange === null ? undefined : 'kg'}
                  size="small"
                  intent="neutral"
                />
                {goal?.targetWeightKg ? (
                  <Metric
                    label="Target"
                    value={goal.targetWeightKg.toFixed(1)}
                    unit="kg"
                    size="small"
                    intent="neutral"
                  />
                ) : null}
              </View>
            </Section>
          </Reveal>

          <Reveal index={1}>
            <Section
              title="Trend"
              footnote={weights.length > 1 ? 'The lighter line is a seven-entry average.' : undefined}
            >
              <LineChart
                points={points}
                average={average}
                color={colors.text}
                xLabels={[formatShortDate(weights[0].date), formatShortDate(weights[weights.length - 1].date)]}
              />
            </Section>
          </Reveal>

          {engine.projection?.targetDate ? (
            <Reveal index={2}>
              <Section title="Projection" footnote={engine.projection.explanation}>
                <MetricRow
                  label="Estimated target date"
                  value={formatShortDate(engine.projection.targetDate)}
                  onPress={() => router.push('/adjust')}
                />
              </Section>
            </Reveal>
          ) : null}

          <Reveal index={3}>
            <Section title="Entries" footnote="Tap an entry to remove it.">
              {[...weights]
                .reverse()
                .slice(0, 20)
                .map((entry, index) => (
                  <View key={entry.id}>
                    {index > 0 ? <Divider /> : null}
                    <MetricRow
                      label={formatShortDate(entry.date)}
                      detail={entry.source === 'manual' ? 'Manual' : entry.source}
                      value={`${entry.weightKg.toFixed(2)} kg`}
                      onPress={() => router.push('/log-weight')}
                    />
                  </View>
                ))}
            </Section>
          </Reveal>
        </>
      )}

      <PrimaryButton label="Log weight" onPress={() => router.push('/log-weight')} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  cta: {
    marginTop: spacing.xl,
  },
});
