import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';

type InputProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  suffix?: string;
  error?: string;
  hint?: string;
  style?: ViewStyle;
};

export function Input({ label, suffix, error, hint, style, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={style}>
      {label ? <Label style={styles.label}>{label}</Label> : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          style={styles.input}
        />
        {suffix ? (
          <Text variant="bodySmall" tone="tertiary">
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

type NumberInputProps = {
  label?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  /** Decimal places accepted; 0 keeps it integer-only. */
  precision?: number;
  placeholder?: string;
  error?: string;
  hint?: string;
  style?: ViewStyle;
};

/**
 * Numeric field with steppers. Kept controlled but tolerant while typing, so a
 * half-written "7." is not destroyed by the parser.
 */
export function NumberInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
  suffix,
  precision = 1,
  placeholder,
  error,
  hint,
  style,
}: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (value === null ? '' : String(value));

  const clamp = (n: number) => {
    let out = n;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    return Number(out.toFixed(precision));
  };

  const commit = () => {
    if (draft === null) return;
    const cleaned = draft.replace(',', '.').trim();
    if (cleaned === '') {
      onChange(null);
    } else {
      const parsed = Number(cleaned);
      if (Number.isFinite(parsed)) onChange(clamp(parsed));
    }
    setDraft(null);
  };

  const nudge = (direction: 1 | -1) => {
    const base = value ?? min ?? 0;
    setDraft(null);
    onChange(clamp(base + direction * step));
  };

  return (
    <View style={style}>
      {label ? <Label style={styles.label}>{label}</Label> : null}
      <View style={[styles.field, !!error && styles.fieldError]}>
        <Pressable
          onPress={() => nudge(-1)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label ?? 'value'}`}
          style={({ pressed }) => [styles.stepper, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name="minus" size={16} color={colors.textSecondary} />
        </Pressable>
        <TextInput
          value={text}
          onChangeText={setDraft}
          onBlur={commit}
          onEndEditing={commit}
          keyboardType={precision > 0 ? 'decimal-pad' : 'number-pad'}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          style={[styles.input, styles.numberInput]}
          accessibilityLabel={label}
        />
        {suffix ? (
          <Text variant="bodySmall" tone="tertiary" style={styles.numberSuffix}>
            {suffix}
          </Text>
        ) : null}
        <Pressable
          onPress={() => nudge(1)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label ?? 'value'}`}
          style={({ pressed }) => [styles.stepper, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name="plus" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
      {error ? (
        <Text variant="caption" tone="danger" style={styles.helper}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="tertiary" style={styles.helper}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldFocused: {
    borderColor: colors.borderStrong,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: spacing.md,
  },
  numberInput: {
    textAlign: 'center',
    fontSize: 17,
    fontVariant: ['tabular-nums'],
  },
  numberSuffix: {
    marginLeft: -spacing.xs,
  },
  stepper: {
    padding: spacing.sm,
  },
  helper: {
    marginTop: spacing.sm,
  },
});
