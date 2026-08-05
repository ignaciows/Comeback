import { Image, StyleSheet, View, type ViewStyle } from 'react-native';

import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { PhaseBody } from '@/domain/body/wireframe';
import { BODY_ART } from '@/features/body/bodyArt';

/**
 * What the plan turns you into, as three figures instead of six numbers.
 *
 * "82 kg at 14 %" is a fact most people cannot picture, and a plan you cannot
 * picture is one you drop in week six. Three silhouettes — today, halfway, the
 * end — say the same thing in a form the eye reads instantly.
 *
 * The caption does the honest work the picture cannot: these are twelve cached
 * figures chosen by build and body fat, not a scan of anybody. Saying
 * "someone your size" rather than "you" is the difference between an
 * illustration and a claim.
 */
export function BodyMilestones({
  bodies,
  labels,
  style,
}: {
  bodies: PhaseBody[];
  /** One per body: "Now", "Halfway", "End". */
  labels: string[];
  style?: ViewStyle;
}) {
  if (bodies.length === 0) return null;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        {bodies.map((body, index) => (
          <View key={`${body.phaseIndex}-${body.key}`} style={styles.cell}>
            <View style={[styles.frame, body.isToday && styles.frameNow]}>
              <Image
                source={BODY_ART[body.key]}
                style={styles.image}
                resizeMode="contain"
                accessibilityLabel={`Wireframe of a ${body.key.split('_')[0]} build at about ${body.bodyFatPercent} % body fat`}
              />
            </View>
            <Label style={styles.label}>{labels[index] ?? ''}</Label>
            <Text variant="caption" mono tone={body.isToday ? 'secondary' : 'primary'}>
              {`${body.weightKg} kg`}
            </Text>
            <Text variant="caption" tone="tertiary">
              {`${body.bodyFatPercent} %`}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="caption" tone="tertiary" style={styles.note}>
        Not a scan of you — a figure of your build at each body fat the plan projects.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  frame: {
    width: '100%',
    aspectRatio: 0.62,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  frameNow: {
    borderColor: colors.accentMuted,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  label: {
    marginTop: spacing.sm,
  },
  note: {
    textAlign: 'center',
  },
});
