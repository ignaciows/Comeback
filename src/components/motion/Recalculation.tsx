import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { EngineResult } from '@/domain/engine';
import { snapshotOf, useRecalcStore, type RecalcChange } from '@/store/useRecalcStore';

/**
 * What just moved.
 *
 * Every row counts from the old number to the new one rather than swapping it,
 * so the change is something you watch happen. It stays until the user leaves
 * the screen — long enough to read, not so long it becomes furniture.
 */

function Row({ change }: { change: RecalcChange }) {
  const rising = change.to > change.from;
  const good =
    change.higherIsBetter === null ? null : change.higherIsBetter === rising;

  const tone = good === null ? colors.textSecondary : good ? colors.accent : colors.warning;

  return (
    <Animated.View entering={FadeIn.duration(240)} style={styles.row} layout={LinearTransition}>
      <Label>{change.label}</Label>
      <View style={styles.values}>
        <Text variant="bodySmall" tone="tertiary" mono>
          {`${Math.round(change.from)}${change.suffix}`}
        </Text>
        <Icon name={rising ? 'arrowUp' : 'arrowDown'} size={14} color={tone} />
        <AnimatedNumber
          value={change.to}
          decimals={change.decimals}
          suffix={change.suffix}
          variant="body"
          style={{ color: tone }}
        />
      </View>
    </Animated.View>
  );
}

/**
 * Settles an armed recalculation once the engine has re-run, and shows the
 * result. Mounted on the screens where plans get changed.
 */
export function Recalculation({ engine }: { engine: EngineResult }) {
  const changes = useRecalcStore((state) => state.changes);
  const cause = useRecalcStore((state) => state.cause);
  const armed = useRecalcStore((state) => state.before !== null);
  const settle = useRecalcStore((state) => state.settle);

  useEffect(() => {
    if (armed) settle(snapshotOf(engine));
  }, [armed, engine, settle]);

  if (changes.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut} style={styles.card}>
      <View style={styles.head}>
        <Text variant="caption" tone="tertiary">
          {cause ?? 'Recalculated'}
        </Text>
      </View>
      {changes.map((change) => (
        <Row key={change.key} change={change} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  values: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
