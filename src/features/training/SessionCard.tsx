import { StyleSheet, View, type ViewStyle } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { StatusPill } from '@/components/Feedback';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { MuscleGroup } from '@/domain/types';
import { MuscleHeatmap } from '@/features/training/MuscleMap';

/**
 * What you are doing today, and the button that starts it.
 *
 * This is the only thing on the home screen that is allowed to be big, and
 * everything about it is chosen so it can be understood without reading: the
 * body is shaded where today's work lands, the three numbers underneath are
 * the three questions anyone asks before a session (how long, how much, how
 * many), and the button is the widest, brightest object on the page.
 *
 * The title is the plain description — "Chest, back and shoulders" — not the
 * routine's name. "Upper A" is shorthand between people who already train, and
 * on someone's first week it is a word that explains nothing. The real name
 * still appears, small, above it, so it can be learned rather than decoded.
 */

export type SessionCardProps = {
  /** Shown small above the title. The routine's own name for the day. */
  eyebrow?: string;
  /** The plain-language title. Big. */
  title: string;
  /** One line under the title. */
  line?: string;
  status: { label: string; tone: 'accent' | 'neutral' | 'info' };
  /** Up to three numbers, each with a word under it. */
  stats?: { value: string; label: string }[];
  /** Shades the figure. Omit to hide the body entirely. */
  setsByMuscle?: Partial<Record<MuscleGroup, number>>;
  action: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
  style?: ViewStyle;
};

export function SessionCard({
  eyebrow,
  title,
  line,
  status,
  stats = [],
  setsByMuscle,
  action,
  secondary,
  style,
}: SessionCardProps) {
  const worked = setsByMuscle && Object.keys(setsByMuscle).length > 0;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <StatusPill label={status.label} tone={status.tone} />
        {eyebrow ? <Label>{eyebrow}</Label> : null}
      </View>

      <Text variant="display" style={styles.title}>
        {title}
      </Text>
      {line ? (
        <Text variant="body" tone="secondary" style={styles.line}>
          {line}
        </Text>
      ) : null}

      {/* The body and the numbers share one band, side by side. The title runs
          the full width above them because it is the sentence someone reads
          first, and boxing it in beside a picture is how a display size ends up
          wrapping every second word. */}
      {worked || stats.length > 0 ? (
        <View style={styles.band}>
          {worked ? <MuscleHeatmap setsByMuscle={setsByMuscle!} height={116} style={styles.body} /> : null}

          {stats.length > 0 ? (
            <View style={styles.stats}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text variant="metric" mono style={styles.statValue}>
                    {stat.value}
                  </Text>
                  <Label style={styles.statLabel}>{stat.label}</Label>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <PrimaryButton label={action.label} onPress={action.onPress} style={styles.cta} />

      {secondary ? <TextButton label={secondary.label} onPress={secondary.onPress} style={styles.alt} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.xl,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: {
    marginTop: spacing.lg,
    fontSize: 32,
    lineHeight: 36,
  },
  line: {
    marginTop: spacing.sm,
  },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: borderWidth.hairline,
    borderTopColor: colors.border,
  },
  body: {
    gap: spacing.md,
  },
  stats: {
    flex: 1,
    gap: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  statValue: {
    minWidth: 46,
    textAlign: 'right',
  },
  statLabel: {
    color: colors.textTertiary,
  },
  cta: {
    marginTop: spacing.xl,
    height: 58,
  },
  alt: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
});
