import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SecondaryButton, TextButton } from '@/components/Button';
import { ProgressBar } from '@/components/ProgressBar';
import { Label, Text } from '@/design-system/Text';
import { colors, radius, spacing } from '@/design-system/tokens';
import { formatDuration } from '@/utils/date';

type Props = {
  /** Timestamp (ms) the rest period started, or null when idle. */
  startedAt: number | null;
  durationSeconds: number;
  onExtend: (seconds: number) => void;
  onDismiss: () => void;
};

/** Plain countdown. Deliberately unanimated — it has to be readable, not lively. */
export function RestTimer({ startedAt, durationSeconds, onExtend, onDismiss }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [startedAt]);

  if (startedAt === null) return null;

  const elapsed = Math.floor((now - startedAt) / 1000);
  const remaining = durationSeconds - elapsed;
  const done = remaining <= 0;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Label>{done ? 'Rest complete' : 'Rest'}</Label>
        <Text variant="metricSmall" mono tone={done ? 'accent' : 'primary'}>
          {done ? formatDuration(Math.abs(remaining)) : formatDuration(remaining)}
        </Text>
      </View>
      <ProgressBar
        value={Math.min(1, elapsed / Math.max(1, durationSeconds))}
        color={done ? colors.accent : colors.textSecondary}
        label="Rest progress"
        style={styles.bar}
      />
      <View style={styles.actions}>
        <SecondaryButton label="+30s" onPress={() => onExtend(30)} block={false} style={styles.extend} />
        <TextButton label="Skip rest" onPress={onDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bar: {
    marginTop: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  extend: {
    height: 36,
    paddingHorizontal: spacing.lg,
  },
});
