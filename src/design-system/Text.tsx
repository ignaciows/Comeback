import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { colors, typography } from './tokens';

type Variant = keyof typeof typography;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'accent' | 'warning' | 'danger' | 'inverse';

const tones: Record<Tone, string> = {
  primary: colors.text,
  secondary: colors.textSecondary,
  tertiary: colors.textTertiary,
  accent: colors.accent,
  warning: colors.warning,
  danger: colors.danger,
  inverse: colors.textInverse,
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Tabular figures: use for any number that updates in place. */
  mono?: boolean;
  uppercase?: boolean;
};

/**
 * The only text primitive in the app. Variants map to the type scale so screens
 * never carry raw font sizes.
 */
export function Text({
  variant = 'body',
  tone = 'primary',
  mono = false,
  uppercase = false,
  style,
  ...rest
}: TextProps) {
  const base = typography[variant] as TextStyle;
  return (
    <RNText
      {...rest}
      style={[
        base,
        { color: tones[tone] },
        mono && { fontVariant: ['tabular-nums'] as TextStyle['fontVariant'] },
        uppercase && { textTransform: 'uppercase' },
        style,
      ]}
    />
  );
}

/** Small uppercase label used above metrics and sections. */
export function Label({ style, ...rest }: Omit<TextProps, 'variant'>) {
  return <Text variant="label" tone="tertiary" uppercase style={style} {...rest} />;
}
