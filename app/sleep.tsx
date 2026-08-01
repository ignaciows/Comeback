import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/Chart';
import { EmptyState, Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { ProgressBar } from '@/components/ProgressBar';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { readinessConfig } from '@/domain/config';
import { qualityScore } from '@/domain/sleep/sleepStats';
import { useSleepNights, useSleepStats } from '@/store/hooks';
import { formatShortDate } from '@/utils/date';

/**
 * Sleep, reported as the three separate things it is.
 *
 * Hours is the number everyone quotes and the weakest of the three. Two seven
 * hour nights are not the same if one was broken and light on deep sleep, and
 * sleeping seven hours at a different time every night is not the same as
 * sleeping seven regularly. Folding them into a single score would hide
 * exactly the part worth acting on.
 */
export default function SleepScreen() {
  const router = useRouter();
  const stats = useSleepStats(14);
  const nights = useSleepNights();

  if (stats.nights === 0) {
    return (
      <Screen>
        <Header title="Sleep" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <EmptyState
          title="No nights yet"
          description="Connect Apple Health and your Watch's nights arrive with their stages. A check-in works too, but only carries hours."
          action={{ label: 'Data sources', onPress: () => router.push('/sources') }}
        />
      </Screen>
    );
  }

  const recent = nights.slice(-28);
  const points = recent.map((night) => ({ x: night.date, y: night.hours }));
  const last = stats.lastNight;
  const lastQuality = last ? qualityScore(last) : null;

  const components: { label: string; value: number | null; help: string }[] = [
    {
      label: 'Duration',
      value: stats.durationScore,
      help: `Hours against the same ${readinessConfig.sleep.poor}–${readinessConfig.sleep.good}h scale readiness uses.`,
    },
    {
      label: 'Quality',
      value: stats.qualityScore,
      help: 'Deep and REM as a share of the night, plus how much of your time in bed was actually asleep. Needs a source that reports stages.',
    },
    {
      label: 'Regularity',
      value: stats.regularityScore,
      help: 'How little your hours move night to night. Needs at least three nights.',
    },
  ];

  return (
    <Screen>
      <Header
        title="Sleep"
        subtitle={`${stats.nights} nights`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <Section>
          <View style={styles.scoreRow}>
            <Text variant="display">{stats.averageHours}h</Text>
            <Text variant="bodySmall" tone="tertiary" mono>
              {`${stats.confidence} confidence`}
            </Text>
          </View>
          <Text variant="bodySmall" tone="secondary" style={styles.headline}>
            {stats.headline}
          </Text>
        </Section>
      </Reveal>

      <Reveal index={1}>
        <Section title="Last 28 nights" footnote="One point per night, in hours asleep.">
          <LineChart
            points={points}
            domain={[0, 10]}
            xLabels={points.length > 1 ? [formatShortDate(points[0].x), 'Last'] : undefined}
          />
        </Section>
      </Reveal>

      <Reveal index={2}>
        <Section title="What it is made of">
          {components.map((component) => (
            <View key={component.label} style={styles.component}>
              <View style={styles.componentHead}>
                <Text variant="body">{component.label}</Text>
                <Text variant="bodySmall" tone="secondary" mono>
                  {component.value === null ? 'No data' : `${Math.round(component.value)}`}
                </Text>
              </View>
              <ProgressBar
                value={component.value === null ? 0 : component.value / 100}
                color={component.value === null ? colors.border : colors.accent}
                label={component.label}
              />
              <Text variant="caption" tone="tertiary" style={styles.componentHelp}>
                {component.help}
              </Text>
            </View>
          ))}
          <Note style={styles.note}>
            These are kept apart on purpose. One number would hide which of the three is the one to fix.
          </Note>
        </Section>
      </Reveal>

      {last ? (
        <Reveal index={3}>
          <Section title="Last night" footnote={formatShortDate(last.date)}>
            <MetricRow label="Asleep" value={`${last.hours}h`} />
            {last.stages ? (
              <>
                <Divider />
                <MetricRow
                  label="Deep"
                  value={`${last.stages.deepMin} min`}
                  detail={`${Math.round((last.stages.deepMin / (last.hours * 60)) * 100)}% of the night · 13–23% is typical`}
                />
                <Divider />
                <MetricRow
                  label="REM"
                  value={`${last.stages.remMin} min`}
                  detail={`${Math.round((last.stages.remMin / (last.hours * 60)) * 100)}% of the night · 20–25% is typical`}
                />
                <Divider />
                <MetricRow label="Core" value={`${last.stages.coreMin} min`} />
              </>
            ) : (
              <>
                <Divider />
                <Text variant="bodySmall" tone="secondary">
                  This night has no stage breakdown — it was either typed in or recorded by a source that only reports
                  total time asleep.
                </Text>
              </>
            )}
            {last.awakeMin !== null ? (
              <>
                <Divider />
                <MetricRow label="Awake in bed" value={`${last.awakeMin} min`} />
              </>
            ) : null}
            {lastQuality !== null ? (
              <>
                <Divider />
                <MetricRow label="Quality" value={`${Math.round(lastQuality)} / 100`} />
              </>
            ) : null}
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={4}>
        <Section title="Sleep debt" footnote={`Hours below ${readinessConfig.sleep.good}h, added up over the window.`}>
          <MetricRow
            label="Last 14 nights"
            value={stats.debtHours === null ? '—' : `${stats.debtHours}h`}
            detail={
              stats.debtHours !== null && stats.debtHours > 10
                ? 'Large enough to be showing up in your training'
                : 'Within a normal range'
            }
          />
        </Section>
      </Reveal>

      <Label style={styles.footer}>Sleep feeds readiness and fuel, not a score of its own</Label>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  headline: {
    marginTop: spacing.md,
  },
  component: {
    marginBottom: spacing.lg,
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
    marginTop: spacing.sm,
  },
  footer: {
    marginTop: spacing.xxl,
    textAlign: 'center',
  },
});
