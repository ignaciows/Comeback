/**
 * Comeback design tokens.
 *
 * One dark palette, one accent, semantic colours used sparingly. Everything
 * spatial is a multiple of 4. Nothing in the app should hardcode a colour,
 * radius or spacing value outside this file.
 */

export const colors = {
  /** Page background — near black, slightly warm so it does not read as void. */
  background: '#0A0B0D',
  /** Raised surface (sheets, active rows). */
  surface: '#121317',
  /** Surface one step further up (modals, pressed states). */
  surfaceRaised: '#1A1C21',
  /** Hairlines and dividers. */
  border: '#22242A',
  borderStrong: '#2E3138',

  /** Primary text — soft white, never pure. */
  text: '#ECEDEF',
  /** Secondary text, labels. */
  textSecondary: '#9A9EA6',
  /** Tertiary text, units, timestamps. */
  textTertiary: '#63676F',
  /** Text on top of the accent. */
  textInverse: '#08120C',

  /** Single accent: actions and positive momentum. */
  accent: '#5BE49B',
  accentMuted: '#2C7A55',
  accentSurface: 'rgba(91, 228, 155, 0.10)',

  /** Semantic, deliberately desaturated. */
  warning: '#E8B451',
  warningSurface: 'rgba(232, 180, 81, 0.10)',
  danger: '#E36A5C',
  dangerSurface: 'rgba(227, 106, 92, 0.10)',
  info: '#6E9BE8',
  infoSurface: 'rgba(110, 155, 232, 0.10)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  thick: 2,
} as const;

export const opacity = {
  disabled: 0.35,
  pressed: 0.6,
  subtle: 0.7,
} as const;

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * Type scale. `mono` is used for any number the user compares over time, so
 * digits do not shift width between renders.
 */
export const typography = {
  display: { fontSize: 56, lineHeight: 58, fontWeight: '300' },
  metric: { fontSize: 34, lineHeight: 38, fontWeight: '400' },
  metricSmall: { fontSize: 22, lineHeight: 26, fontWeight: '400' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  bodySmall: { fontSize: 13, lineHeight: 19, fontWeight: '400' },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.8 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
} as const;

export const duration = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

export const layout = {
  screenPadding: spacing.xl,
  tabBarHeight: 56,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
} as const;

export type ColorToken = keyof typeof colors;
