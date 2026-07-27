import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/design-system/Icon';
import { Text } from '@/design-system/Text';
import { borderWidth, colors, layout, opacity, radius, spacing } from '@/design-system/tokens';
import type { WorkoutSet } from '@/domain/types';

type Props = {
  set: WorkoutSet;
  index: number;
  /** What was done for this set last time, if anything. */
  previous: string | null;
  editable?: boolean;
  onChange: (patch: Partial<WorkoutSet>) => void;
  onComplete: () => void;
  onRemove: () => void;
};

function Field({
  value,
  onCommit,
  placeholder,
  accessibilityLabel,
  decimals = 1,
}: {
  value: number | null;
  onCommit: (value: number | null) => void;
  placeholder: string;
  accessibilityLabel: string;
  decimals?: number;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value === null ? '' : String(value));

  const commit = () => {
    if (draft === null) return;
    const cleaned = draft.replace(',', '.').trim();
    if (cleaned === '') onCommit(null);
    else {
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) onCommit(Number(parsed.toFixed(decimals)));
    }
    setDraft(null);
  };

  return (
    <TextInput
      value={text}
      onChangeText={setDraft}
      onBlur={commit}
      onEndEditing={commit}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      selectionColor={colors.accent}
      keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
      accessibilityLabel={accessibilityLabel}
      style={styles.field}
    />
  );
}

/**
 * One set. Optimised for use mid-session: large tap targets, previous values
 * pre-filled, and a single tap to confirm when nothing changed.
 */
export function SetRow({ set, index, previous, editable = true, onChange, onComplete, onRemove }: Props) {
  return (
    <View style={[styles.row, set.completed && styles.rowCompleted]}>
      <Pressable
        onPress={() => onChange({ warmup: !set.warmup })}
        disabled={!editable}
        hitSlop={layout.hitSlop}
        accessibilityRole="button"
        accessibilityLabel={set.warmup ? 'Mark as working set' : 'Mark as warm-up'}
        style={styles.index}
      >
        <Text variant="bodySmall" tone={set.warmup ? 'tertiary' : 'secondary'} mono>
          {set.warmup ? 'W' : index + 1}
        </Text>
      </Pressable>

      <Text variant="caption" tone="tertiary" style={styles.previous} numberOfLines={1}>
        {previous ?? '—'}
      </Text>

      <Field
        value={set.weightKg}
        onCommit={(value) => onChange({ weightKg: value })}
        placeholder="kg"
        accessibilityLabel={`Set ${index + 1} weight`}
        decimals={2}
      />
      <Field
        value={set.reps}
        onCommit={(value) => onChange({ reps: value })}
        placeholder="reps"
        accessibilityLabel={`Set ${index + 1} reps`}
        decimals={0}
      />
      <Field
        value={set.rir}
        onCommit={(value) => onChange({ rir: value })}
        placeholder="RIR"
        accessibilityLabel={`Set ${index + 1} reps in reserve`}
        decimals={0}
      />

      <Pressable
        onPress={onComplete}
        hitSlop={layout.hitSlop}
        accessibilityRole="button"
        accessibilityLabel={set.completed ? `Undo set ${index + 1}` : `Complete set ${index + 1}`}
        style={({ pressed }) => [
          styles.check,
          set.completed && styles.checkDone,
          pressed && { opacity: opacity.pressed },
        ]}
      >
        <Icon name="check" size={15} color={set.completed ? colors.textInverse : colors.textTertiary} />
      </Pressable>

      {editable ? (
        <Pressable
          onPress={onRemove}
          hitSlop={layout.hitSlop}
          accessibilityRole="button"
          accessibilityLabel={`Remove set ${index + 1}`}
          style={({ pressed }) => [styles.remove, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name="close" size={14} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  rowCompleted: {
    opacity: 0.85,
  },
  index: {
    width: 22,
    alignItems: 'center',
  },
  previous: {
    width: 62,
  },
  field: {
    flex: 1,
    minWidth: 44,
    height: 40,
    textAlign: 'center',
    color: colors.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    borderRadius: radius.sm,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  check: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  checkDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  remove: {
    paddingHorizontal: 2,
  },
});
