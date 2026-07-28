import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Reveal } from '@/components/motion/Reveal';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { Divider, Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { observationCoverage } from '@/domain/inference/observations';
import type { Proposal } from '@/domain/inference/proposals';
import { scheduleTrainingReminders } from '@/services/notifications/reminders';
import { useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { snapshotOf, useRecalcStore } from '@/store/useRecalcStore';

/** "07:05" from separate hour and minute. */
function clock(hour: number, minute: number): string {
  return `${`${hour}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
}

/**
 * What the app has worked out on its own.
 *
 * Shown in full, including what it has not worked out yet, because a thing
 * that adjusts your plan behind your back should be inspectable. Every line is
 * a measurement with its evidence and what it is used for — never a claim the
 * data does not carry.
 */
export default function KnowsScreen() {
  const router = useRouter();
  const engine = useEngine();
  const applyProposal = useAppStore((state) => state.applyProposal);
  const dismissProposal = useAppStore((state) => state.dismissProposal);
  const applied = useAppStore((state) => state.appliedProposals);
  const arm = useRecalcStore((state) => state.arm);

  const { observations, proposals, reminder } = engine;
  const coverage = observationCoverage(observations);
  const open = proposals.filter((entry) => !applied.includes(entry.id));

  const [reminderState, setReminderState] = useState<'off' | 'working' | 'on'>('off');
  const [reminderMessage, setReminderMessage] = useState<string | null>(null);

  const enableReminders = async () => {
    if (!reminder) return;
    setReminderState('working');
    const outcome = await scheduleTrainingReminders(reminder);

    setReminderState(outcome.status === 'scheduled' ? 'on' : 'off');
    setReminderMessage(
      outcome.status === 'scheduled'
        ? `Set for ${outcome.count} day${outcome.count === 1 ? '' : 's'} a week. It follows your pattern if it changes.`
        : outcome.status === 'denied'
          ? 'Notifications are off for Comeback in your phone settings.'
          : outcome.status === 'unavailable'
            ? 'This build cannot schedule notifications.'
            : outcome.message,
    );
  };

  const accept = (proposal: Proposal) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    arm(snapshotOf(engine), proposal.headline);
    applyProposal(proposal);
  };

  return (
    <Screen>
      <Header
        title="What the app knows"
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <View style={styles.hero}>
          <Label>Learned about you</Label>
          <View style={styles.heroValue}>
            <AnimatedNumber value={coverage * 100} variant="display" style={styles.heroNumber} />
            <Text variant="title" tone="tertiary">
              %
            </Text>
          </View>
          <ProgressBar value={coverage} style={styles.bar} />
          <Text variant="bodySmall" tone="secondary">
            {coverage === 0
              ? 'Train a few sessions and this fills in on its own.'
              : 'Everything here came from sessions you logged. None of it was a question.'}
          </Text>
        </View>
      </Reveal>

      {open.length > 0 ? (
        <Reveal index={1}>
          <Section title="Worth changing">
            {open.map((proposal, index) => (
              <View key={proposal.id}>
                {index > 0 ? <Divider /> : null}
                <View style={styles.proposal}>
                  <View style={styles.proposalHead}>
                    <Text variant="body">{proposal.headline}</Text>
                    <StatusPill
                      label={proposal.kind === 'auto' ? 'Correction' : 'Your call'}
                      tone={proposal.kind === 'auto' ? 'info' : 'accent'}
                    />
                  </View>
                  <Text variant="bodySmall" tone="secondary" style={styles.proposalDetail}>
                    {proposal.detail}
                  </Text>
                  <View style={styles.actions}>
                    <PrimaryButton label="Apply" onPress={() => accept(proposal)} style={styles.apply} />
                    <TextButton label="No" onPress={() => dismissProposal(proposal.id)} />
                  </View>
                </View>
              </View>
            ))}
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={2}>
        <Section title="Noticed">
          {observations.list.map((entry, index) => (
            <View key={entry.id}>
              {index > 0 ? <Divider /> : null}
              <View style={styles.row}>
                <View style={styles.rowMain}>
                  <Text variant="bodySmall" tone={entry.display ? 'primary' : 'tertiary'}>
                    {entry.label}
                  </Text>
                  {entry.used ? (
                    <Text variant="caption" tone="tertiary" style={styles.used}>
                      {entry.used}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.rowValue}>
                  <Text variant="body" mono tone={entry.display ? 'primary' : 'tertiary'}>
                    {entry.display ?? 'not yet'}
                  </Text>
                  {entry.display ? (
                    <Text variant="caption" tone="tertiary">
                      {`${entry.sampleSize} logged`}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
        </Section>
      </Reveal>

      {reminder ? (
        <Reveal index={3}>
          <Section title="Nudge">
            <Text variant="bodySmall" tone="secondary">
              {`${reminder.label}, so a reminder lands at ${clock(reminder.hour, reminder.minute)} — half an hour before, with time to leave.`}
            </Text>
            <PrimaryButton
              label={reminderState === 'on' ? 'Reminders on' : 'Remind me then'}
              disabled={reminderState === 'on'}
              loading={reminderState === 'working'}
              onPress={() => void enableReminders()}
              style={styles.remindCta}
            />
            {reminderMessage ? (
              <Text variant="caption" tone="tertiary" style={styles.remindNote}>
                {reminderMessage}
              </Text>
            ) : null}
          </Section>
        </Reveal>
      ) : null}

      <Note>
        Nothing leaves your phone. The app corrects its own guesses; anything you committed to waits for you.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  heroValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  heroNumber: {
    fontSize: 48,
    lineHeight: 52,
  },
  bar: {
    marginVertical: spacing.lg,
  },
  proposal: {
    paddingVertical: spacing.md,
  },
  proposalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  proposalDetail: {
    marginTop: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  apply: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  rowMain: {
    flex: 1,
  },
  rowValue: {
    alignItems: 'flex-end',
  },
  used: {
    marginTop: spacing.xs,
  },
  remindCta: {
    marginTop: spacing.lg,
  },
  remindNote: {
    marginTop: spacing.md,
  },
});
