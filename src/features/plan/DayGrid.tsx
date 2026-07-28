import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

import { Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { ISODate } from '@/domain/types';

/**
 * The plan as squares to fill in.
 *
 * One rounded square per day, in rows of a week. A day you trained is solid, a
 * day you logged something else is outlined, a day you were meant to train and
 * did not stays empty. Today breathes.
 *
 * The whole point is that progress becomes something you can see the shape of
 * from across the room — how much is filled, where the gaps are, how much is
 * still ahead — without reading a single number. It is also the reason it is
 * worth opening the app on a rest day: the square still gets marked.
 */

export type DayState = 'trained' | 'logged' | 'rest' | 'missed' | 'today' | 'future';

export type GridDay = {
  date: ISODate;
  state: DayState;
};

/** Generic over the day, so a caller can hand back its own richer record. */
type Props<T extends GridDay> = {
  days: T[];
  /** Square edge in points. Smaller when the range is long. */
  size?: number;
  onPressDay?: (day: T) => void;
  style?: ViewStyle;
};

function Cell({ day, size, onPress }: { day: GridDay; size: number; onPress?: () => void }) {
  const beat = useLoop(motion.loop.breathe);

  const pulse = useAnimatedStyle(() => ({
    opacity: day.state === 'today' ? 0.55 + Math.sin(beat.value * Math.PI) * 0.45 : 1,
  }));

  return (
    <Animated.View
      onTouchEnd={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${day.date}, ${day.state}`}
      style={[
        styles.cell,
        { width: size, height: size },
        STATE_STYLE[day.state],
        pulse,
      ]}
    />
  );
}

export function DayGrid<T extends GridDay>({ days, size = 13, onPressDay, style }: Props<T>) {
  // Rows of seven so a column is always the same weekday.
  const rows: T[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    rows.push(days.slice(index, index + 7));
  }

  return (
    <View style={style}>
      <View style={styles.grid}>
        {rows.map((row, rowIndex) => (
          <Animated.View
            key={row[0]?.date ?? rowIndex}
            entering={FadeIn.delay(rowIndex * 30).duration(motion.duration.base)}
            style={styles.row}
          >
            {row.map((day) => (
              <Cell
                key={day.date}
                day={day}
                size={size}
                onPress={onPressDay ? () => onPressDay(day) : undefined}
              />
            ))}
          </Animated.View>
        ))}
      </View>
    </View>
  );
}

/** A short legend. Used once, on the journal, not on every screen. */
export function DayGridLegend({ style }: { style?: ViewStyle }) {
  const items: { state: DayState; label: string }[] = [
    { state: 'trained', label: 'Trained' },
    { state: 'logged', label: 'Logged' },
    { state: 'missed', label: 'Missed' },
    { state: 'future', label: 'Ahead' },
  ];

  return (
    <View style={[styles.legend, style]}>
      {items.map((item) => (
        <View key={item.state} style={styles.legendItem}>
          <View style={[styles.cell, { width: 10, height: 10 }, STATE_STYLE[item.state]]} />
          <Text variant="caption" tone="tertiary">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const STATE_STYLE: Record<DayState, ViewStyle> = {
  trained: { backgroundColor: colors.accent, borderColor: colors.accent },
  logged: { backgroundColor: colors.accentSurface, borderColor: colors.accentMuted },
  rest: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  missed: { backgroundColor: 'transparent', borderColor: colors.warning },
  today: { backgroundColor: colors.accentSurface, borderColor: colors.accent },
  future: { backgroundColor: 'transparent', borderColor: colors.border },
};

const styles = StyleSheet.create({
  grid: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  cell: {
    borderRadius: radius.sm,
    borderWidth: borderWidth.hairline,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
