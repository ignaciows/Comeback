import { Pressable, StyleSheet, View } from 'react-native';

import { StatusPill } from '@/components/Feedback';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { colors, opacity, radius, spacing } from '@/design-system/tokens';
import { momentumConfig } from '@/domain/config';
import { momentumStateLabel } from '@/domain/momentum/calculateMomentum';
import type { Confidence, MomentumStateId } from '@/domain/types';

const TONE: Record<MomentumStateId, 'accent' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  strong: 'accent',
  building: 'accent',
  recovering: 'info',
  stable: 'neutral',
  at_risk: 'warning',
  declining: 'danger',
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

type Props = {
  score: number | null;
  state: MomentumStateId;
  delta: number | null;
  confidence: Confidence;
  explanation: string;
  onPress?: () => void;
};

/**
 * The dominant reading on Today. Shows the score, where it sits across the
 * state bands, which way it is moving and — in one line — why.
 */
export function MomentumIndicator({ score, state, delta, confidence, explanation, onPress }: Props) {
  const tone = TONE[state];
  const accent =
    tone === 'accent'
      ? colors.accent
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : tone === 'info'
            ? colors.info
            : colors.textSecondary;

  const body = (
    <View>
      <View style={styles.head}>
        <Label>Momentum</Label>
        <StatusPill label={momentumStateLabel(state)} tone={tone} />
      </View>

      <View style={styles.valueRow}>
        <Text variant="display" mono style={{ color: score === null ? colors.textTertiary : colors.text }}>
          {score === null ? '—' : Math.round(score)}
        </Text>
        {delta !== null && Math.abs(delta) >= 0.1 ? (
          <View style={styles.delta}>
            <Icon
              name={delta > 0 ? 'arrowUp' : 'arrowDown'}
              size={16}
              color={delta > 0 ? colors.accent : colors.warning}
            />
            <Text variant="bodySmall" mono style={{ color: delta > 0 ? colors.accent : colors.warning }}>
              {`${Math.abs(delta).toFixed(1)} / 7d`}
            </Text>
          </View>
        ) : (
          <Text variant="bodySmall" tone="tertiary">
            {score === null ? 'No data yet' : 'Flat this week'}
          </Text>
        )}
      </View>

      <View style={styles.scale}>
        {momentumConfig.states.map((band, index) => {
          const next = momentumConfig.states[index + 1];
          const upper = next ? next.min : 100;
          const active = score !== null && score >= band.min && score < upper + (next ? 0 : 1);
          return (
            <View
              key={band.id}
              style={[
                styles.band,
                { flex: upper - band.min },
                active && { backgroundColor: accent },
              ]}
            />
          );
        })}
      </View>
      <View style={styles.scaleLabels}>
        <Text variant="caption" tone="tertiary">
          Declining
        </Text>
        <Text variant="caption" tone="tertiary">
          Strong
        </Text>
      </View>

      <Text variant="bodySmall" tone="secondary" style={styles.explanation}>
        {explanation}
      </Text>
      <View style={styles.footer}>
        <Text variant="caption" tone="tertiary">
          {CONFIDENCE_LABEL[confidence]}
        </Text>
        {onPress ? (
          <View style={styles.more}>
            <Text variant="caption" tone="tertiary">
              What moved it
            </Text>
            <Icon name="chevronRight" size={12} color={colors.textTertiary} />
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Momentum details"
      style={({ pressed }) => (pressed ? { opacity: opacity.pressed } : undefined)}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  scale: {
    flexDirection: 'row',
    gap: 3,
    marginTop: spacing.md,
  },
  band: {
    height: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  explanation: {
    marginTop: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  more: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
