import { StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/Text';
import { colors, radius, spacing } from '@/design-system/tokens';
import type { SessionLevels } from '@/domain/training/sessionLevels';

/**
 * How much of the whole workout is behind you — levels only, no sublevels.
 *
 * Deliberately the one place in the guided screen that talks about the
 * session as a whole. Everything above it is about the set in front of you,
 * and this exists so that narrowing the focus does not also mean losing the
 * sense of how far along you are. It counts exercises cleared rather than
 * sets, because "two of six" is what you would tell someone who asked.
 */
export function WorkoutFooter({ levels }: { levels: SessionLevels }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(levels.overall * 100)}%` }]} />
      </View>
      <Text variant="caption" tone="tertiary">
        {levels.caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  track: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
});
