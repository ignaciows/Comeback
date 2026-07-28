import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { Commitment } from '@/domain/plan/commitments';

/**
 * What the plan requires, and how you are doing against it.
 *
 * Each row is a bar: the required amount is the full width, what you are doing
 * fills it. Two glances tell you the answer, which is the whole design brief —
 * "you picked this plan, here is what it costs" without a paragraph.
 *
 * A requirement the app cannot measure gets no bar and no tick. It is still
 * listed, because it is still required — a calorie target the user has to hit
 * on their own is not less real for being invisible to the phone.
 */

type Props = {
  commitments: Commitment[];
  style?: ViewStyle;
};

function format(value: number, unit: string): string {
  const rounded = value % 1 === 0 ? `${value}` : value.toFixed(1);
  return unit ? `${rounded} ${unit}` : rounded;
}

export function RequirementList({ commitments, style }: Props) {
  return (
    <View style={style}>
      {commitments.map((commitment) => {
        const measurable = commitment.met !== null && commitment.ratio !== null;
        const fill = Math.min(100, (commitment.ratio ?? 0) * 100);
        const colour = commitment.met ? colors.accent : colors.warning;

        return (
          <View key={commitment.id} style={styles.row}>
            <View style={styles.head}>
              <View style={styles.labelRow}>
                {measurable ? (
                  <Icon
                    name={commitment.met ? 'check' : 'minus'}
                    size={14}
                    color={commitment.met ? colors.accent : colors.textTertiary}
                  />
                ) : (
                  <Icon name="info" size={14} color={colors.textTertiary} />
                )}
                <Text variant="bodySmall">{commitment.label}</Text>
              </View>

              <View style={styles.values}>
                {commitment.observed !== null ? (
                  <>
                    <AnimatedNumber
                      value={commitment.observed}
                      decimals={commitment.observed % 1 === 0 ? 0 : 1}
                      variant="bodySmall"
                      style={{ color: colour }}
                    />
                    <Text variant="bodySmall" tone="tertiary" mono>
                      {` / ${format(commitment.required, commitment.unit)}`}
                    </Text>
                  </>
                ) : (
                  <Text variant="bodySmall" tone="secondary" mono>
                    {format(commitment.required, commitment.unit)}
                  </Text>
                )}
              </View>
            </View>

            {measurable ? (
              <View style={styles.track}>
                <Animated.View
                  layout={LinearTransition.duration(420)}
                  style={[styles.fill, { width: `${fill}%`, backgroundColor: colour }]}
                />
              </View>
            ) : null}

            <Text variant="caption" tone="tertiary">
              {commitment.note}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  values: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
});
