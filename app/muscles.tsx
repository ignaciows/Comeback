import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/Button';
import { EmptyState, Note, StatusPill } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Label, Text } from '@/design-system/Text';
import { colors, radius, spacing } from '@/design-system/tokens';
import { exerciseName } from '@/data/exercises';
import type { MuscleScore } from '@/domain/training/muscleRanking';
import { rankingHeadline } from '@/domain/training/muscleRanking';
import { useMuscleRanking } from '@/store/hooks';

/**
 * Where you are strong, and what is holding the rest back.
 *
 * Ordered weakest first on purpose. A ranking read strongest-first is a
 * trophy cabinet — you look at the top, feel good, and change nothing. The
 * useful end is the bottom, and the useful finding is not a rank at all but a
 * ratio: "your press is half your bench" is something to do on Monday, and
 * "your back scores 1.12" is trivia.
 *
 * No test session to unlock it. The app has been estimating a max from every
 * set you log since the first one, so asking someone to go and max out would
 * be asking for a number it already has at the price of the single session
 * most likely to injure them.
 */
export default function MusclesScreen() {
  const router = useRouter();
  const ranking = useMuscleRanking();

  if (ranking.thin) {
    return (
      <Screen>
        <Header
          title="Muscle ranking"
          leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
        />
        <EmptyState
          title="Not enough to rank yet"
          description="This needs a few logged lifts and a recent weigh-in — every score is a lift divided by your body weight, so without one there is nothing to divide by. Log a couple of sessions and it fills in."
          action={{ label: 'Log a weigh-in', onPress: () => router.push('/log-weight') }}
        />
      </Screen>
    );
  }

  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title="Muscle ranking"
        subtitle={rankingHeadline(ranking)}
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      {ranking.imbalances.length > 0 ? (
        <Reveal index={0}>
          <Section title="Worth fixing">
            {ranking.imbalances.map((entry) => (
              <View key={`${entry.lagging}_${entry.reference}`} style={styles.gap}>
                <View style={styles.gapHead}>
                  <Text variant="heading">{`${entry.lagging} behind ${entry.reference}`}</Text>
                  <Text variant="bodySmall" mono tone="warning">
                    {`${entry.ratio.toFixed(2)} vs ${entry.expected.toFixed(2)}`}
                  </Text>
                </View>
                <Text variant="bodySmall" tone="secondary">
                  {entry.finding}
                </Text>
                <Text variant="bodySmall">{entry.action}</Text>
                <Text variant="caption" tone="tertiary">
                  {`From ${exerciseName(entry.liftIds[0])} against ${exerciseName(entry.liftIds[1])}.`}
                </Text>
              </View>
            ))}
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={1}>
        <Section title="Weakest first">
          <Text variant="bodySmall" tone="secondary" style={styles.explain}>
            Each lift divided by what that lift usually is at your body weight,
            so a press and a squat can be compared at all. 1.00 is ordinary for
            a trained lifter — it is not a percentile.
          </Text>
          {ranking.weakest.map((score) => (
            <Row key={score.muscle} score={score} />
          ))}
        </Section>
      </Reveal>

      <Reveal index={2}>
        <Note>
          Estimates, from estimated maxes. The ranking between your own lifts is
          the reliable part; the absolute numbers carry real error, because what
          a lift "usually is" varies with limb length and with whose data you
          read.
        </Note>
      </Reveal>

      <Reveal index={3}>
        <PrimaryButton
          label="Test the lifts you have not logged"
          onPress={() => router.push('/assessment')}
          style={styles.test}
        />
      </Reveal>
    </Screen>
  );
}

/** A muscle, its score, and the bar that makes the gaps readable at a glance. */
function Row({ score }: { score: MuscleScore }) {
  // Anchored at 1.0 in the middle, so the bar reads as "behind" or "ahead"
  // rather than as a progress bar towards a number nobody set.
  const fill = Math.min(1, score.relative / 1.6);

  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text variant="body">{score.muscle}</Text>
        <View style={styles.rowMeta}>
          {score.confidence === 'low' ? <StatusPill label="rough" tone="info" /> : null}
          <Text variant="bodySmall" mono tone={score.relative < 0.85 ? 'warning' : 'secondary'}>
            {score.relative.toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${fill * 100}%`, backgroundColor: score.relative < 0.85 ? colors.warning : colors.accent },
          ]}
        />
        {/* Where 1.00 sits, so the bar has a meaning and not just a length. */}
        <View style={[styles.mark, { left: `${(1 / 1.6) * 100}%` }]} />
      </View>

      {score.from.length > 0 ? (
        <Label style={styles.from}>{score.from.map(exerciseName).join(' · ')}</Label>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  gapHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: 2,
  },
  row: {
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  track: {
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    height: 6,
    borderRadius: radius.sm,
  },
  mark: {
    position: 'absolute',
    width: 1,
    height: 6,
    backgroundColor: colors.border,
  },
  from: {
    opacity: 0.7,
  },
  explain: {
    marginBottom: spacing.md,
  },
  test: {
    marginTop: spacing.lg,
  },
});
