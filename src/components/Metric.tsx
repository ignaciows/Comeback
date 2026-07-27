import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { colors, layout, opacity, spacing } from '@/design-system/tokens';

export type Trend = 'up' | 'down' | 'flat';

type MetricProps = {
  label: string;
  value: string;
  unit?: string;
  /** Direction of change; `intent` decides whether that direction is good. */
  trend?: Trend;
  trendLabel?: string;
  /** How to colour the trend: 'positive' means up is good. */
  intent?: 'positive' | 'negative' | 'neutral';
  size?: 'large' | 'small';
  /** Shown under the value; use it to say what the number means. */
  caption?: string;
  style?: ViewStyle;
};

function trendTone(trend: Trend, intent: MetricProps['intent']) {
  if (trend === 'flat' || intent === 'neutral') return colors.textSecondary;
  const good = intent === 'negative' ? trend === 'down' : trend === 'up';
  return good ? colors.accent : colors.warning;
}

/** A single number with its label, optional unit, trend and meaning. */
export function Metric({
  label,
  value,
  unit,
  trend,
  trendLabel,
  intent = 'positive',
  size = 'large',
  caption,
  style,
}: MetricProps) {
  return (
    <View style={style}>
      <Label>{label}</Label>
      <View style={styles.valueRow}>
        <Text variant={size === 'large' ? 'metric' : 'metricSmall'} mono>
          {value}
        </Text>
        {unit ? (
          <Text variant="bodySmall" tone="tertiary" style={styles.unit}>
            {unit}
          </Text>
        ) : null}
        {trend ? (
          <View style={styles.trend}>
            <Icon
              name={trend === 'up' ? 'arrowUp' : trend === 'down' ? 'arrowDown' : 'arrowFlat'}
              size={14}
              color={trendTone(trend, intent)}
            />
            {trendLabel ? (
              <Text variant="caption" mono style={{ color: trendTone(trend, intent) }}>
                {trendLabel}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {caption ? (
        <Text variant="caption" tone="tertiary" style={styles.caption}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

type RowProps = {
  label: string;
  value?: string;
  detail?: string;
  onPress?: () => void;
  accessory?: ReactNode;
  /** Renders a chevron and makes the row feel navigable. */
  chevron?: boolean;
  style?: ViewStyle;
};

/** Label/value row used in lists, settings and summaries. */
export function MetricRow({ label, value, detail, onPress, accessory, chevron, style }: RowProps) {
  const content = (
    <View style={[styles.row, style]}>
      <View style={styles.rowLabel}>
        <Text variant="body">{label}</Text>
        {detail ? (
          <Text variant="caption" tone="tertiary" style={styles.caption}>
            {detail}
          </Text>
        ) : null}
      </View>
      {accessory}
      {value ? (
        <Text variant="body" tone="secondary" mono>
          {value}
        </Text>
      ) : null}
      {chevron || onPress ? (
        <Icon name="chevronRight" size={16} color={colors.textTertiary} />
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={layout.hitSlop}
      style={({ pressed }) => (pressed ? { opacity: opacity.pressed } : undefined)}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  unit: {
    marginLeft: -spacing.xs + 2,
  },
  trend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginLeft: spacing.xs,
  },
  caption: {
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowLabel: {
    flex: 1,
  },
});
