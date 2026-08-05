import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Text } from '@/design-system/Text';
import { motion } from '@/design-system/motion';
import { colors, radius, spacing } from '@/design-system/tokens';
import type { SessionLevels } from '@/domain/training/sessionLevels';

/**
 * The sublevels of the level you are on, and nothing else.
 *
 * The bar this replaces drew one sliver per working set of the whole session
 * — twenty-four of them for a six-exercise day. Most were about work you will
 * not touch for another forty minutes, and between sets the only thing anyone
 * wants to know is how many more of *these* there are. So the pips are the
 * sets of the current exercise, at a size you can count without focusing, and
 * the rest of the workout gets one line at the foot of the screen instead.
 */
export function LevelTrack({ levels }: { levels: SessionLevels }) {
  return (
    <View style={styles.wrap}>
      <Text variant="caption" tone="tertiary" mono>
        {levels.title}
      </Text>

      <View style={styles.pips}>
        {levels.sublevels.map((sublevel) => (
          <Animated.View
            key={sublevel.setId}
            entering={FadeIn.duration(motion.duration.fast)}
            accessibilityLabel={`Set ${sublevel.index}${sublevel.done ? ', done' : sublevel.current ? ', now' : ''}`}
            style={[
              styles.pip,
              sublevel.done && styles.pipDone,
              // The one you are on is outlined rather than filled: filling it
              // would read as already done, which is the opposite of the point.
              sublevel.current && styles.pipCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  pips: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pip: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  pipDone: {
    backgroundColor: colors.accent,
  },
  pipCurrent: {
    backgroundColor: colors.accentSurface,
    borderWidth: 1,
    borderColor: colors.accent,
  },
});
