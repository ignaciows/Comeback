import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';

export type Option<T extends string | number> = {
  value: T;
  label: string;
  detail?: string;
};

type Props<T extends string | number> = {
  label?: string;
  options: Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** `row` for 2–4 short options, `list` for longer labelled choices. */
  layout?: 'row' | 'list' | 'wrap';
  style?: ViewStyle;
};

export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
  layout = 'row',
  style,
}: Props<T>) {
  return (
    <View style={style}>
      {label ? <Label style={styles.label}>{label}</Label> : null}
      <View style={[layout === 'row' && styles.row, layout === 'wrap' && styles.wrap, layout === 'list' && styles.list]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.option,
                layout === 'row' && styles.optionRow,
                layout === 'list' && styles.optionList,
                selected && styles.optionSelected,
                pressed && { opacity: opacity.pressed },
              ]}
            >
              <Text variant={layout === 'list' ? 'body' : 'bodySmall'} tone={selected ? 'primary' : 'secondary'}>
                {option.label}
              </Text>
              {option.detail ? (
                <Text variant="caption" tone="tertiary" style={styles.detail}>
                  {option.detail}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  option: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionRow: {
    flex: 1,
    alignItems: 'center',
  },
  optionList: {
    alignItems: 'flex-start',
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSurface,
  },
  detail: {
    marginTop: 2,
  },
});
