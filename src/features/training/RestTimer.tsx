import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';

import { SecondaryButton, TextButton } from '@/components/Button';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { colors, radius, spacing } from '@/design-system/tokens';
import { formatDuration } from '@/utils/date';

type Props = {
  /** Timestamp (ms) the rest period started, or null when idle. */
  startedAt: number | null;
  durationSeconds: number;
  onExtend: (seconds: number) => void;
  onDismiss: () => void;
};

const SIZE = 56;
const STROKE = 3;

/**
 * Countdown between sets. The ring drains in real time and the block pulses
 * once rest is up, so you can read it from arm's length without unlocking your
 * attention from the bar.
 */
export function RestTimer({ startedAt, durationSeconds, onExtend, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [alerted, setAlerted] = useState(false);
  const beat = useLoop(motion.loop.heartbeat);

  useEffect(() => {
    if (startedAt === null) return;
    setAlerted(false);
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [startedAt]);

  const elapsed = startedAt === null ? 0 : Math.floor((now - startedAt) / 1000);
  const remaining = durationSeconds - elapsed;
  const done = remaining <= 0;

  useEffect(() => {
    if (startedAt !== null && done && !alerted) {
      setAlerted(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [done, alerted, startedAt]);

  const ready = useAnimatedStyle(() => ({
    opacity: done ? interpolate(beat.value, [0, 1], [0.55, 1]) : 1,
  }));

  if (startedAt === null) return null;

  const radiusPx = (SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radiusPx;
  const progress = Math.min(1, Math.max(0, elapsed / Math.max(1, durationSeconds)));

  return (
    <Animated.View style={[styles.root, ready]}>
      <View style={styles.dial}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={radiusPx} stroke={colors.border} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radiusPx}
            stroke={done ? colors.accent : colors.textSecondary}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
      </View>

      <View style={styles.body}>
        <Label>{done ? 'Rest complete' : 'Resting'}</Label>
        <Text variant="metricSmall" mono tone={done ? 'accent' : 'primary'}>
          {formatDuration(Math.abs(remaining))}
        </Text>
      </View>

      <View style={styles.actions}>
        <SecondaryButton label="+30s" onPress={() => onExtend(30)} block={false} style={styles.extend} />
        <TextButton label="Skip" onPress={onDismiss} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  dial: {
    width: SIZE,
    height: SIZE,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  actions: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  extend: {
    height: 34,
    paddingHorizontal: spacing.md,
  },
});
