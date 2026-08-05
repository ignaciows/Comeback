import { Image, StyleSheet, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { Label, Text } from '@/design-system/Text';
import { Icon } from '@/design-system/Icon';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { exerciseName } from '@/data/exercises';
import { warmupForExercise } from '@/domain/training/warmup';
import { WARMUP_ART } from '@/features/training/warmupArt';

/**
 * The two minutes before the first set of a lift.
 *
 * Deliberately not a list you scroll: two to four movements, the dose, and one
 * line each on what it is for. Someone standing at a rack reads this once and
 * then does it, so anything that needs a second read has failed.
 *
 * Skippable without ceremony, and skipping is a real button rather than a
 * greyed-out afterthought. A warm-up screen you cannot get past is a warm-up
 * screen people learn to dread, and this has to survive being seen six times
 * a session.
 */
export function WarmupBrief({
  exerciseId,
  onReady,
  onSkip,
}: {
  exerciseId: string;
  onReady: () => void;
  onSkip: () => void;
}) {
  const drills = warmupForExercise(exerciseId);

  return (
    <View style={styles.wrap}>
      <Label>Before you start</Label>
      <Text variant="title" style={styles.title}>
        {exerciseName(exerciseId)}
      </Text>
      <Text variant="body" tone="secondary" style={styles.lead}>
        {`${drills.length} movements to get the right joints moving. Keep them light — this is not the set.`}
      </Text>

      <View style={styles.list}>
        {drills.map((drill) => (
          <View key={drill.id} style={styles.drill}>
            {/* The picture matters more here than on the lifts: nobody arrives
                already knowing what a 90/90 is, and a name plus one line is not
                enough to attempt a movement you have never seen. */}
            {WARMUP_ART[drill.id] ? (
              <Image
                source={WARMUP_ART[drill.id]}
                style={styles.art}
                resizeMode="contain"
                accessibilityLabel={`${drill.name}, wireframe illustration`}
              />
            ) : null}
            <View style={styles.drillHead}>
              <Text variant="heading">{drill.name}</Text>
              <Text variant="caption" mono tone="tertiary">
                {drill.dose}
              </Text>
            </View>
            <Text variant="bodySmall" tone="secondary">
              {drill.why}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.note}>
        <Icon name="info" size={13} color={colors.textTertiary} />
        <Text variant="caption" tone="tertiary" style={styles.noteText}>
          Move through the range rather than holding a stretch — holding one costs you strength on
          the set that follows.
        </Text>
      </View>

      <PrimaryButton label="Ready" onPress={onReady} style={styles.cta} />
      <TextButton label="Skip the warm-up" onPress={onSkip} style={styles.skip} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: spacing.xl,
  },
  title: {
    marginTop: spacing.sm,
  },
  lead: {
    marginTop: spacing.sm,
  },
  list: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  drill: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  art: {
    width: '100%',
    height: 150,
    marginBottom: spacing.sm,
  },
  drillHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  noteText: {
    flex: 1,
  },
  cta: {
    marginTop: spacing.xl,
  },
  skip: {
    alignSelf: 'center',
    marginTop: spacing.md,
  },
});
