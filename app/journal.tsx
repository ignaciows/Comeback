import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { TextButton } from '@/components/Button';
import { StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/Metric';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { buildJournal, futureDays, summariseJournal, type JournalDay } from '@/domain/journal';
import { sessionMechanics } from '@/domain/training/sessionMetrics';
import { sessionSetCount, sessionVolume } from '@/domain/training/metrics';
import { DayGrid, DayGridLegend } from '@/features/plan/DayGrid';
import { useAppStore } from '@/store/useAppStore';
import { formatLongDate, today as todayOf } from '@/utils/date';

const RANGES = [
  { value: 56, label: '8w' },
  { value: 112, label: '16w' },
  { value: 168, label: '24w' },
];

/**
 * Every day, as a square.
 *
 * The grid is the record: filled where you trained, outlined where you logged
 * something without training, empty where a planned day went by. Tapping one
 * opens what happened. Days ahead are drawn too, because the thing worth
 * seeing is not only what you did but how much is still there to fill.
 */
export default function JournalScreen() {
  const router = useRouter();
  const sessions = useAppStore((state) => state.sessions);
  const plannedSessions = useAppStore((state) => state.plannedSessions);
  const checkins = useAppStore((state) => state.checkins);
  const measurements = useAppStore((state) => state.bodyMeasurements);

  const [range, setRange] = useState(56);
  const [selected, setSelected] = useState<JournalDay | null>(null);

  const today = todayOf();

  const days = useMemo(
    () => buildJournal({ today, days: range, sessions, plannedSessions, checkins, measurements }),
    [today, range, sessions, plannedSessions, checkins, measurements],
  );

  // Round the row out to the end of the week so the grid has no ragged edge.
  const ahead = useMemo(() => futureDays(today, 7 - (days.length % 7 || 7) + 7, plannedSessions), [today, days.length, plannedSessions]);
  const summary = useMemo(() => summariseJournal(days), [days]);

  const selectedMechanics = selected?.session ? sessionMechanics(selected.session) : null;

  return (
    <Screen>
      <Header
        title="Journal"
        subtitle={`${summary.trained} sessions in ${range / 7} weeks`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <View style={styles.card}>
          <DayGrid days={[...days, ...ahead]} onPressDay={setSelected} size={range > 112 ? 10 : 13} />
          <DayGridLegend />
        </View>
      </Reveal>

      <Reveal index={1}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Label>Trained</Label>
            <AnimatedNumber value={summary.trained} variant="title" />
          </View>
          <View style={styles.stat}>
            <Label>Best run</Label>
            <View style={styles.statValue}>
              <AnimatedNumber value={summary.streak} variant="title" style={{ color: colors.accent }} />
              <Text variant="bodySmall" tone="tertiary">
                days
              </Text>
            </View>
          </View>
          <View style={styles.stat}>
            <Label>Missed</Label>
            <AnimatedNumber
              value={summary.missed}
              variant="title"
              style={{ color: summary.missed > 0 ? colors.warning : colors.text }}
            />
          </View>
        </View>
      </Reveal>

      <Reveal index={2}>
        <Section title="Range">
          <SegmentedControl options={RANGES} value={range} onChange={setRange} />
        </Section>
      </Reveal>

      <BottomSheet
        visible={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? formatLongDate(selected.date) : ''}
        subtitle={selected?.state === 'missed' ? 'Planned, not trained' : undefined}
      >
        {selected?.session ? (
          <>
            <MetricRow label="Session" value={selected.session.name} />
            <Divider />
            <MetricRow label="Sets" value={`${sessionSetCount(selected.session)}`} />
            <Divider />
            <MetricRow label="Volume" value={`${Math.round(sessionVolume(selected.session))} kg`} />
            {selectedMechanics?.durationMinutes ? (
              <>
                <Divider />
                <MetricRow label="Duration" value={`${selectedMechanics.durationMinutes} min`} />
              </>
            ) : null}
            <TextButton
              label="Open session"
              onPress={() => {
                const id = selected.session?.id;
                setSelected(null);
                if (id) router.push({ pathname: '/workout/[id]', params: { id } });
              }}
              style={styles.sheetAction}
            />
          </>
        ) : null}

        {selected?.weight ? (
          <>
            {selected.session ? <Divider /> : null}
            <MetricRow
              label="Weight"
              value={`${selected.weight.weightKg.toFixed(1)} kg`}
              accessory={
                selected.weight.source !== 'manual' ? <StatusPill label="Imported" tone="info" /> : undefined
              }
            />
          </>
        ) : null}

        {selected?.checkin ? (
          <>
            <Divider />
            <MetricRow
              label="Sleep"
              value={selected.checkin.sleepHours ? `${selected.checkin.sleepHours.toFixed(1)} h` : '—'}
            />
          </>
        ) : null}

        {selected && !selected.session && !selected.weight && !selected.checkin ? (
          <Text variant="bodySmall" tone="secondary" style={styles.empty}>
            {selected.state === 'missed'
              ? 'A session was scheduled and did not happen. Nothing is lost — the plan moves.'
              : selected.state === 'future'
                ? 'Still ahead of you.'
                : 'A rest day. Nothing was scheduled.'}
          </Text>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  stat: {
    gap: spacing.sm,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  sheetAction: {
    alignSelf: 'flex-start',
    marginTop: spacing.lg,
  },
  empty: {
    paddingVertical: spacing.lg,
  },
});
