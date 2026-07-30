import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { differencesFrom, previousPlan, revertSuggestion } from '@/domain/plan/history';
import { asObjective, asSpeed } from '@/domain/plan/commitments';
import { useAppStore } from '@/store/useAppStore';
import { formatShortDate, today as todayOf } from '@/utils/date';

/**
 * Going back to the plan you were on.
 *
 * Two things make this worth having a screen of its own rather than a menu row.
 *
 * The first is that "revert your plan?" is a question nobody can answer, so
 * this one is answered field by field — pace, target, days a week — with the
 * old value next to the current one. You are agreeing to specific numbers, not
 * to an abstraction.
 *
 * The second is the sentence at the bottom, and it is the whole reason people
 * hesitate: nothing you have done is undone. Every session, every weigh-in,
 * every day in the journal stays exactly where it is. Only the plan moves.
 */
export default function PreviousPlanScreen() {
  const router = useRouter();
  const history = useAppStore((state) => state.planHistory);
  const goal = useAppStore((state) => state.goal);
  const training = useAppStore((state) => state.training);
  const sessions = useAppStore((state) => state.sessions);
  const revert = useAppStore((state) => state.revertPlan);

  const snapshot = previousPlan(history);
  const suggestion = revertSuggestion(history, sessions, todayOf());

  if (!snapshot || !goal) {
    return (
      <Screen>
        <Header
          title="Previous plan"
          leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
        />
        <Text variant="body" tone="secondary" style={styles.empty}>
          You have not changed your plan yet. Once you do, the one you were on stays here so you can come
          back to it.
        </Text>
      </Screen>
    );
  }

  const differences = differencesFrom(snapshot, {
    goal: {
      objective: asObjective(goal.objective),
      speed: asSpeed(goal.speed),
      strategy: goal.strategy,
      fatTolerance: goal.fatTolerance,
      targetWeightKg: goal.targetWeightKg,
      horizonWeeks: goal.horizonWeeks,
      muscleFocus: goal.muscleFocus ?? [],
    },
    training: {
      preferredDaysPerWeek: training.preferredDaysPerWeek,
      preferredWeekdays: training.preferredWeekdays,
      sessionMinutes: training.sessionMinutes,
    },
  });

  const goBack = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    revert();
    router.replace('/(tabs)/plan');
  };

  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title="The plan you were on"
        subtitle={`${snapshot.reason} · ${formatShortDate(snapshot.takenOn)}`}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {/* Only shown when the app has actual evidence, never as a nudge. */}
      {suggestion ? (
        <Reveal index={0}>
          <View style={styles.evidence}>
            <Text variant="title">{suggestion.headline}</Text>
            <Text variant="body" tone="secondary" style={styles.evidenceLine}>
              {suggestion.detail}
            </Text>
          </View>
        </Reveal>
      ) : null}

      <Reveal index={1}>
        <Section title="What would change" footnote="Left is now. Right is what you would go back to.">
          {differences.length === 0 ? (
            <Text variant="body" tone="secondary">
              Nothing — the plan is already the same as it was.
            </Text>
          ) : (
            differences.map((difference) => (
              <View key={difference.label} style={styles.row}>
                <Label style={styles.rowLabel}>{difference.label}</Label>
                <View style={styles.values}>
                  <Text variant="body" tone="tertiary">
                    {difference.from}
                  </Text>
                  <Icon name="arrowFlat" size={14} color={colors.textTertiary} />
                  <Text variant="body">{difference.to}</Text>
                </View>
              </View>
            ))
          )}
        </Section>
      </Reveal>

      <Reveal index={2}>
        <Note>
          Nothing you have done is undone. Every session, weigh-in and day in the journal stays exactly
          where it is — only the plan goes back.
        </Note>

        <PrimaryButton
          label="Go back to this plan"
          onPress={goBack}
          disabled={differences.length === 0}
          style={styles.cta}
        />
        <TextButton label="Stay on the current plan" onPress={() => router.back()} style={styles.stay} />
      </Reveal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: {
    marginTop: spacing.xl,
  },
  evidence: {
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  evidenceLine: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLabel: {
    flex: 1,
  },
  values: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cta: {
    marginTop: spacing.xl,
  },
  stay: {
    alignSelf: 'center',
    marginTop: spacing.md,
  },
});
