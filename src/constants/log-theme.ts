/**
 * Design tokens for the Log Food screen, ported from DESIGN_SYSTEM.md.
 * Token names follow §14.1 of that doc: the source CSS used `--lime-*` for indigo,
 * `--violet-*` for green and `--apricot-*` for amber — renamed here to their real colors.
 */

export const LogColor = {
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  green400: '#4ADE80',
  green500: '#22C55E',
  greenText: '#15803D', // AA-safe green for small text (§11 / §14.7)
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amberText: '#B45309', // AA-safe amber for small text (§11 / §14.7)
  red500: '#EF4444',

  white: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate500: '#64748B',
  slate600: '#475569',
  slate900: '#111827',
  track: '#E9EDF3',

  bgApp: '#F8FAFC',
  bgSurfaceSolid: '#FFFFFF',
  bgSurface: 'rgba(255,255,255,0.9)',
  bgSurfaceWarm: 'rgba(99,102,241,0.05)',
  brandPrimary: '#6366F1',
  brandPrimaryStrong: '#4F46E5',
  textPrimary: '#111827',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textOnBrand: '#FFFFFF',
  borderSubtle: '#E2E8F0',
  borderStrong: '#CBD5E1',
  trackEmpty: '#E9EDF3',
  accentProtein: '#6366F1',
  accentCarbs: '#F59E0B',
  warnFat: '#22C55E',
  stateError: '#EF4444',

  overlayPress: 'rgba(17,24,39,0.04)',
  overlayBackdrop: 'rgba(17,24,39,0.34)',
  ringFocus: 'rgba(99,102,241,0.25)',

  chipIndigoTint: 'rgba(99,102,241,0.12)',
  chipGreenTint: 'rgba(34,197,94,0.12)',
  chipAmberTint: 'rgba(245,158,11,0.12)',
  successTint: 'rgba(34,197,94,0.10)',
  viewfinderBg: '#111827',
} as const;

/**
 * Gradient color stops for expo-linear-gradient's <LinearGradient colors={...} />.
 * RN's `experimental_backgroundImage` CSS-string style (used elsewhere in this scaffold, e.g.
 * animated-icon.tsx) does not render on react-native-web, so gradients here go through an actual
 * <LinearGradient> component instead for correct cross-platform (iOS/Android/web) rendering.
 */
export const LogGradientColors = {
  primary: ['#818CF8', '#4F46E5'] as [string, string], // buttons, active pills, water fill, protein bar
  success: ['#4ADE80', '#22C55E'] as [string, string], // calorie progress, fat bar
  accent: ['#FBBF24', '#F59E0B'] as [string, string], // carbs bar
} as const;

export const LogGradientAngle = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;

// RN's Fabric renderer accepts a CSS box-shadow string (including multiple layers) via `boxShadow`.
export const LogShadow = {
  sm: '0px 1px 2px rgba(17,24,39,0.04), 0px 4px 12px rgba(17,24,39,0.05)',
  md: '0px 6px 18px rgba(17,24,39,0.07), 0px 2px 4px rgba(17,24,39,0.05)',
  lg: '0px 18px 44px rgba(17,24,39,0.14)',
  glowPrimary: '0px 10px 24px rgba(99,102,241,0.28), 0px 2px 6px rgba(99,102,241,0.16)',
} as const;

export const LogRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
} as const;

export const LogSpace = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const LogFontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const LogFontSize = {
  hero: 52,
  display2: 36,
  display: 28,
  h1: 22,
  h2: 18,
  body: 15,
  small: 13,
  micro: 11,
  nano: 10, // §14.2: covers the off-scale 9/9.5/10/10.5px values
  stat: 21, // §14.2: off-scale MacroBar value size, kept as its own token
} as const;

export const LogMotion = {
  instant: 90,
  fast: 140,
  base: 220,
  slow: 340,
} as const;

/** letterSpacing tokens are defined in em in the source; RN's letterSpacing is absolute px. */
export const trackTight = (fontSize: number) => Math.round(fontSize * -0.03 * 100) / 100;
export const trackSnug = (fontSize: number) => Math.round(fontSize * -0.015 * 100) / 100;
export const trackWide = (fontSize: number) => Math.round(fontSize * 0.08 * 100) / 100;
