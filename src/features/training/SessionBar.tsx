import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle } from 'react-native-reanimated';

import { PrimaryButton, SecondaryButton } from '@/components/Button';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import {
  describePause,
  formatClock,
  type SessionProgress,
} from '@/domain/training/sessionProgress';

/**
 * The state of the session you are in, at arm's length.
 *
 * Read between sets, one-handed, by someone slightly out of breath — so the
 * clock is large, the buttons are thumb-sized, and there is exactly one
 * decision on screen at a time: pause when running, continue when paused.
 *
 * While paused everything is stated plainly: how long you have been stopped,
 * and what that length means for the next set. It never tells you to hurry.
 * A long pause is sometimes a phone call and sometimes the right call.
 */

type Props = {
  progress: SessionProgress;
  usualRestSeconds: number;
  onPause: () => void;
  onResume: () => void;
};

export function SessionBar({ progress, usualRestSeconds, onPause, onResume }: Props) {
  const beat = useLoop(motion.loop.heartbeat);

  // Running: a slow breath. Paused: still, because nothing is happening.
  const live = useAnimatedStyle(() => ({
    opacity: progress.isPaused ? 0.4 : 0.5 + Math.sin(beat.value * Math.PI) * 0.5,
  }));

  const completion = progress.completion ?? 0;

  return (
    <Animated.View
      entering={FadeIn.duration(motion.duration.base)}
      style={[styles.card, progress.isPaused ? styles.paused : null]}
    >
      <View style={styles.head}>
        <View style={styles.status}>
          <Animated.View style={[styles.dot, progress.isPaused ? styles.dotPaused : null, live]} />
          <Label>{progress.isPaused ? 'Paused' : 'Session running'}</Label>
        </View>
        <Text variant="caption" tone="tertiary" mono>
          {`${progress.setsDone} / ${progress.setsPlanned} sets`}
        </Text>
      </View>

      <Text variant="display" mono style={styles.clock}>
        {formatClock(progress.isPaused ? (progress.currentPauseSeconds ?? 0) : progress.activeSeconds)}
      </Text>

      <Text variant="caption" tone="tertiary">
        {progress.isPaused
          ? describePause(progress.currentPauseSeconds ?? 0, usualRestSeconds)
          : progress.pausedSeconds > 0
            ? `${formatClock(progress.pausedSeconds)} paused so far · not counted`
            : 'Training time, pauses excluded.'}
      </Text>

      {/* How much of the session is behind you. */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(completion * 100)}%` }]} />
      </View>

      {progress.isPaused ? (
        <PrimaryButton label="Continue" onPress={onResume} style={styles.action} />
      ) : (
        <SecondaryButton label="Pause" onPress={onPause} style={styles.action} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  paused: {
    borderColor: colors.warning,
    backgroundColor: colors.warningSurface,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  dotPaused: {
    backgroundColor: colors.warning,
  },
  clock: {
    fontSize: 52,
    lineHeight: 56,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  action: {
    marginTop: spacing.md,
  },
});
