import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Text } from '@/design-system/Text';
import { colors, radius, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import { VOLUME_BANDS, type MuscleVolume } from '@/domain/training/volume';

/**
 * Weekly sets per muscle, as bars against the range that actually grows
 * muscle.
 *
 * The band from 10 to 20 sets is drawn behind every bar, so "enough" is a
 * position on the screen rather than a number to remember. A bar short of the
 * band is the app saying that muscle is being maintained, not built — without
 * writing that sentence ten times.
 */

type Props = {
  volume: MuscleVolume[];
  /** Tapping a muscle, when the parent has somewhere to go. */
  onPress?: (muscle: MuscleVolume) => void;
  style?: ViewStyle;
};

/** Bars are drawn against a fixed ceiling so they stay comparable week to week. */
const SCALE_MAX = 26;

export function VolumeBars({ volume, onPress, style }: Props) {
  const bandStart = (VOLUME_BANDS.maintenance / SCALE_MAX) * 100;
  const bandWidth = ((VOLUME_BANDS.ceiling - VOLUME_BANDS.maintenance) / SCALE_MAX) * 100;

  return (
    <View style={style}>
      {volume.map((entry) => {
        const width = Math.min(100, (entry.sets / SCALE_MAX) * 100);
        const colour = entry.focused
          ? colors.accent
          : entry.status === 'under'
            ? colors.borderStrong
            : colors.accentMuted;

        return (
          <Pressable
            key={entry.muscle}
            style={styles.row}
            onPress={onPress ? () => onPress(entry) : undefined}
            accessibilityRole={onPress ? 'button' : undefined}
            accessibilityLabel={`${MUSCLE_GROUP_LABELS[entry.muscle]}, ${entry.sets} sets a week`}
          >
            <Text
              variant="caption"
              tone={entry.focused ? 'primary' : 'tertiary'}
              style={styles.name}
              numberOfLines={1}
            >
              {MUSCLE_GROUP_LABELS[entry.muscle]}
            </Text>

            <View style={styles.track}>
              {/* The productive range, drawn once behind the bar. */}
              <View style={[styles.band, { left: `${bandStart}%`, width: `${bandWidth}%` }]} />
              <Animated.View
                layout={LinearTransition.duration(420)}
                style={[styles.bar, { width: `${width}%`, backgroundColor: colour }]}
              />
            </View>

            <Text variant="caption" tone="tertiary" mono style={styles.value}>
              {entry.sets % 1 === 0 ? `${entry.sets}` : entry.sets.toFixed(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  name: {
    width: 74,
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.accentSurface,
  },
  bar: {
    height: 10,
    borderRadius: radius.pill,
  },
  value: {
    width: 26,
    textAlign: 'right',
  },
});
