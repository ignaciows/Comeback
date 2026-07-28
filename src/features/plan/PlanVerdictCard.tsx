import { StyleSheet, View, type ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/Button';
import { StatusPill } from '@/components/Feedback';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { PlanVerdict } from '@/domain/plan/verdict';

/**
 * Whether the plan you picked is the plan you are on — said out loud.
 *
 * The tone is the point. Being behind is stated without scolding, because
 * someone who feels judged by a training app deletes the training app; and
 * being ahead is stated as an offer, because the ceiling turning out to be the
 * plan rather than the person is worth hearing.
 */

type Props = {
  verdict: PlanVerdict;
  /** Label for the action button; nothing renders when there is no action. */
  actionLabel?: string;
  onAct?: () => void;
  style?: ViewStyle;
};

const TONE: Record<PlanVerdict['state'], { pill: string; colour: string; surface: string }> = {
  establishing: { pill: 'Learning', colour: colors.border, surface: colors.surface },
  on_track: { pill: 'On plan', colour: colors.accentMuted, surface: colors.accentSurface },
  ahead: { pill: 'Ahead', colour: colors.accent, surface: colors.accentSurface },
  slipping: { pill: 'Behind', colour: colors.border, surface: colors.surface },
  too_demanding: { pill: 'Mismatch', colour: colors.warning, surface: colors.warningSurface },
};

export function PlanVerdictCard({ verdict, actionLabel, onAct, style }: Props) {
  const tone = TONE[verdict.state];

  return (
    <View style={[styles.card, { borderColor: tone.colour, backgroundColor: tone.surface }, style]}>
      <View style={styles.head}>
        <Text variant="body">{verdict.headline}</Text>
        <StatusPill
          label={tone.pill}
          tone={
            verdict.state === 'too_demanding'
              ? 'warning'
              : verdict.state === 'ahead' || verdict.state === 'on_track'
                ? 'accent'
                : 'neutral'
          }
        />
      </View>

      <Text variant="bodySmall" tone="secondary" style={styles.detail}>
        {verdict.detail}
      </Text>

      {verdict.action && onAct && actionLabel ? (
        <PrimaryButton label={actionLabel} onPress={onAct} style={styles.cta} />
      ) : null}
    </View>
  );
}

/** The button copy for each action, written as the user's own decision. */
export function verdictActionLabel(verdict: PlanVerdict): string | null {
  const action = verdict.action;
  if (!action) return null;

  switch (action.kind) {
    case 'lower_frequency':
      return `Move me to a ${action.toSessions}-day plan`;
    case 'raise_frequency':
      return `Go up to ${action.toSessions} days`;
    case 'accelerate':
      return 'Go faster';
    case 'log_more':
      return null;
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    padding: spacing.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  detail: {
    marginTop: spacing.sm,
  },
  cta: {
    marginTop: spacing.lg,
  },
});
