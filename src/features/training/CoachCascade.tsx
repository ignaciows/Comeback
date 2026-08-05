import { StyleSheet, View } from 'react-native';

import { Reveal } from '@/components/motion/Reveal';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { coachCascade } from '@/domain/training/coachCascade';
import { AnatomyMap } from '@/features/training/AnatomyMap';

/**
 * The lift, top to bottom, with a reason attached to every part of it.
 *
 * Ordered the way the rep happens rather than the way a reference book is
 * organised: get into position, go down, come back up, feel the right thing,
 * get better over weeks. Each stage leads with the coach's reason and then
 * gives the instructions, in that order deliberately — a rule you were given
 * a reason for is one you can still apply next month, and one you can adapt
 * when your body does not match the diagram.
 *
 * The numbered rail down the left side is what makes it read as one argument
 * descending rather than five unrelated cards.
 */
export function CoachCascade({ exerciseId }: { exerciseId: string }) {
  const stages = coachCascade(exerciseId);
  if (stages.length === 0) return null;

  return (
    <View>
      {stages.map((stage, index) => (
        <Reveal key={stage.key} index={index}>
          <View style={styles.stage}>
            {/* The rail: a number and the line joining it to the next stage. */}
            <View style={styles.rail}>
              <View style={styles.bead}>
                <Text variant="caption" mono style={styles.beadText}>
                  {index + 1}
                </Text>
              </View>
              {index < stages.length - 1 ? <View style={styles.thread} /> : null}
            </View>

            <View style={styles.body}>
              <Text variant="heading">{stage.title}</Text>

              {/* The reason comes before the instructions, always. */}
              <Text variant="body" tone="secondary" style={styles.why}>
                {stage.why}
              </Text>

              {stage.showsMuscles ? (
                <View style={styles.muscles}>
                  <AnatomyMap exerciseId={exerciseId} height={200} />
                </View>
              ) : null}

              {stage.points.length > 0 ? (
                <View style={styles.points}>
                  {stage.key === 'progress' ? (
                    <Label style={styles.pointsLabel}>What usually goes wrong</Label>
                  ) : null}
                  {stage.points.map((point) => (
                    <View key={point} style={styles.point}>
                      <Icon
                        name={stage.key === 'progress' ? 'info' : 'check'}
                        size={12}
                        color={stage.key === 'progress' ? colors.warning : colors.accent}
                      />
                      <Text variant="bodySmall" tone="secondary" style={styles.pointText}>
                        {point}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        </Reveal>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    alignItems: 'center',
    width: 26,
  },
  bead: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beadText: {
    color: colors.accent,
  },
  thread: {
    flex: 1,
    width: borderWidth.hairline,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  body: {
    flex: 1,
    paddingBottom: spacing.xl,
  },
  why: {
    marginTop: spacing.sm,
  },
  muscles: {
    marginTop: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
  },
  points: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  pointsLabel: {
    marginBottom: spacing.xs,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  pointText: {
    flex: 1,
  },
});
