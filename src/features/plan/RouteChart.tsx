import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import type { RouteSimulation } from '@/domain/plan/routes';

type Props = {
  simulation: RouteSimulation;
  height?: number;
  /** Draws the body-fat curve underneath, when the data exists. */
  showBodyFat?: boolean;
  /** Vertical hairlines and labels where one block hands over to the next. */
  showBlocks?: boolean;
  /** Shared y-range, so several routes can be compared at a glance. */
  domain?: [number, number];
  style?: ViewStyle;
};

/**
 * The shape of a route: body weight over the whole plan, with the block
 * boundaries marked.
 *
 * The point of drawing it is that "bulk then cut" and "lean bulk" end up in a
 * similar place by very different paths, and the curve makes that obvious in a
 * way a table of numbers never does.
 */
export function RouteChart({
  simulation,
  height = 120,
  showBodyFat = false,
  showBlocks = true,
  domain,
  style,
}: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const points = simulation.points;
  const padding = 8;
  const innerHeight = height - padding * 2;

  const weights = points.map((point) => point.weightKg);
  const min = domain ? domain[0] : Math.min(...weights);
  const max = domain ? domain[1] : Math.max(...weights);
  const span = max - min || 1;

  const x = (week: number) => (week / Math.max(1, simulation.totalWeeks)) * Math.max(1, width);
  const y = (value: number) => padding + innerHeight - ((value - min) / span) * innerHeight;

  /** One path per block, so each phase can carry its own colour. */
  const blockPaths = simulation.blocks.map((block) => {
    const segment = points.filter(
      (point) => point.week >= block.startWeek && point.week <= block.endWeek,
    );
    const d = segment
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.week).toFixed(1)},${y(point.weightKg).toFixed(1)}`)
      .join(' ');
    // Gaining phases take the accent; losing phases the quieter tone.
    const gaining = block.weightChangeKg > 0;
    return { d, color: gaining ? colors.accent : colors.info, block };
  });

  const bodyFatValues = points
    .map((point) => point.bodyFatPercent)
    .filter((value): value is number => value !== null);
  const bodyFatPath =
    showBodyFat && bodyFatValues.length === points.length
      ? points
          .map((point, index) => {
            const fatMin = Math.min(...bodyFatValues);
            const fatMax = Math.max(...bodyFatValues);
            const fatSpan = fatMax - fatMin || 1;
            const fy = padding + innerHeight - ((((point.bodyFatPercent as number) - fatMin) / fatSpan) * innerHeight) * 0.5;
            return `${index === 0 ? 'M' : 'L'}${x(point.week).toFixed(1)},${fy.toFixed(1)}`;
          })
          .join(' ')
      : null;

  const last = points[points.length - 1];

  return (
    <View onLayout={onLayout} style={style}>
      <Svg width={width} height={height}>
        {showBlocks
          ? simulation.blocks.slice(1).map((block) => (
              <Line
                key={block.index}
                x1={x(block.startWeek)}
                y1={0}
                x2={x(block.startWeek)}
                y2={height}
                stroke={colors.borderStrong}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
            ))
          : null}

        {bodyFatPath ? (
          <Path d={bodyFatPath} stroke={colors.warning} strokeWidth={1} fill="none" opacity={0.5} />
        ) : null}

        {blockPaths.map((entry) => (
          <Path
            key={entry.block.index}
            d={entry.d}
            stroke={entry.color}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        <Circle cx={x(last.week) - 1} cy={y(last.weightKg)} r={3} fill={colors.text} />
      </Svg>

      {showBlocks ? (
        <View style={styles.legend}>
          {simulation.blocks.map((block) => (
            <View key={block.index} style={styles.legendItem}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: block.weightChangeKg > 0 ? colors.accent : colors.info },
                ]}
              />
              <Text variant="caption" tone="tertiary">
                {`${block.label} · ${block.weeks}w`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 8,
    height: 3,
    borderRadius: 2,
  },
});
