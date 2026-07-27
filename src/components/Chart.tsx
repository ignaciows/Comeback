import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from '@/design-system/Text';
import { colors, radius, spacing } from '@/design-system/tokens';

export type ChartPoint = { x: string; y: number };

type LineChartProps = {
  points: ChartPoint[];
  /** Optional smoothed series drawn behind the main line. */
  average?: ChartPoint[];
  height?: number;
  color?: string;
  /** Shown at the ends of the x axis. */
  xLabels?: [string, string];
  /** Forces the y range; otherwise it fits the data with a small margin. */
  domain?: [number, number];
  style?: ViewStyle;
};

/**
 * Small line chart. No grid, no legend, no decoration — enough to read a trend
 * and nothing more. Renders nothing when there is not enough data to be honest
 * about a shape.
 */
export function LineChart({
  points,
  average,
  height = 120,
  color = colors.accent,
  xLabels,
  domain,
  style,
}: LineChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  if (points.length < 2) {
    return (
      <View style={[styles.placeholder, { height }, style]} onLayout={onLayout}>
        <Text variant="caption" tone="tertiary">
          At least two points are needed to draw a trend.
        </Text>
      </View>
    );
  }

  const values = [...points.map((point) => point.y), ...(average ?? []).map((point) => point.y)];
  const min = domain ? domain[0] : Math.min(...values);
  const max = domain ? domain[1] : Math.max(...values);
  const span = max - min || 1;
  const padding = 6;
  const innerHeight = height - padding * 2;

  const toPath = (series: ChartPoint[]) =>
    series
      .map((point, index) => {
        const x = (index / (series.length - 1)) * Math.max(1, width);
        const y = padding + innerHeight - ((point.y - min) / span) * innerHeight;
        return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');

  const last = points[points.length - 1];
  const lastX = width;
  const lastY = padding + innerHeight - ((last.y - min) / span) * innerHeight;

  return (
    <View onLayout={onLayout} style={style}>
      <Svg width={width} height={height}>
        <Line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke={colors.border} strokeWidth={1} />
        {average && average.length > 1 ? (
          <Path d={toPath(average)} stroke={colors.textTertiary} strokeWidth={1.25} fill="none" />
        ) : null}
        <Path d={toPath(points)} stroke={color} strokeWidth={1.75} fill="none" strokeLinejoin="round" />
        <Circle cx={lastX - 2} cy={lastY} r={2.5} fill={color} />
      </Svg>
      {xLabels ? (
        <View style={styles.axis}>
          <Text variant="caption" tone="tertiary">
            {xLabels[0]}
          </Text>
          <Text variant="caption" tone="tertiary">
            {xLabels[1]}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Horizontal bar used for relative comparisons (volume per muscle group). */
export function BarRow({
  label,
  value,
  max,
  valueLabel,
  color = colors.accent,
}: {
  label: string;
  value: number;
  max: number;
  valueLabel: string;
  color?: string;
}) {
  const ratio = max > 0 ? Math.max(0.02, value / max) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barHead}>
        <Text variant="bodySmall" tone="secondary">
          {label}
        </Text>
        <Text variant="caption" tone="tertiary" mono>
          {valueLabel}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

/** Activity grid: one cell per day, filled when a session was logged. */
export function ActivityGrid({
  days,
  columns = 14,
}: {
  days: { date: string; active: boolean; missed?: boolean }[];
  columns?: number;
}) {
  const rows: (typeof days)[] = [];
  for (let index = 0; index < days.length; index += columns) {
    rows.push(days.slice(index, index + columns));
  }
  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row[0]?.date} style={styles.gridRow}>
          {row.map((day) => (
            <View
              key={day.date}
              style={[
                styles.cell,
                day.active && { backgroundColor: colors.accent },
                !day.active && day.missed && { backgroundColor: colors.dangerSurface },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  barRow: {
    marginBottom: spacing.md,
  },
  barHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  barTrack: {
    height: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: radius.sm,
  },
  grid: {
    gap: 4,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 16,
    borderRadius: 3,
    backgroundColor: colors.surface,
  },
});
