/**
 * Global Nora AI Nutrition color tokens, ported from DESIGN_SYSTEM.md, in a light and a dark
 * palette with the same keys. Token names follow §14.1 of that doc: the source CSS used
 * `--lime-*` for indigo, `--violet-*` for green and `--apricot-*` for amber — renamed here to
 * their real colors.
 *
 * Components never import a palette directly: they read the active one with `useColors()` or
 * build styles with `useStyles(makeStyles)` (see ./use-theme.ts), so night mode applies
 * everywhere.
 *
 * The design system defines only a light v2 palette. The dark one follows the usual dark-UI
 * rules so it is easy on the eyes: a neutral graphite ground rather than saturated navy,
 * off-white text (~13:1, not pure white on near-black, which glows), and desaturated accents —
 * full-saturation indigo/green/amber vibrate on dark. Glows become plain shadows.
 *
 * The named colors (indigo500, white, slate900, …) mean the same in both palettes — white
 * text on an indigo button stays white. Anything that is a surface, text or border uses a
 * semantic token instead.
 *
 * Domain-specific color semantics (e.g. macro nutrient colors) do not live here — see
 * `src/features/food/theme.ts` for those.
 */

const named = {
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  green400: '#4ADE80',
  green500: '#22C55E',
  amber400: '#FBBF24',
  amber500: '#F59E0B',
  red500: '#EF4444',

  white: '#FFFFFF',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate500: '#64748B',
  slate600: '#475569',
  slate900: '#111827',
} as const;

export type Palette = typeof named & {
  greenText: string;
  amberText: string;
  track: string;

  bgApp: string;
  bgSurfaceSolid: string;
  bgSurface: string;
  bgSurfaceWarm: string;
  /** Quiet filled tile: neutral icon chips, inactive keys. */
  surfaceMuted: string;
  /** Indigo for text, icons, lines and rings on the page. */
  brandPrimary: string;
  brandPrimaryStrong: string;
  /** Solid indigo behind white text or icons (buttons, badges) — AA with white in both themes. */
  brandFill: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnBrand: string;
  borderSubtle: string;
  borderStrong: string;
  trackEmpty: string;
  stateError: string;
  /** Text for errors and "over target" on the page background (AA in both themes). */
  errorText: string;
  /** Soft red fill behind destructive icon buttons. */
  dangerTint: string;
  /** Solid green behind white checkmarks (added, done, success toast). */
  successFill: string;

  overlayPress: string;
  overlayBackdrop: string;
  ringFocus: string;

  chipIndigoTint: string;
  chipGreenTint: string;
  chipAmberTint: string;
  successTint: string;
  warningTint: string;
  /** Faint brand wash: highlighted rows, dashed pickers. */
  brandWash: string;
  brandTint: string;

  /** Gradient stops for <LinearGradient colors={...} /> — buttons, active pills, progress. */
  gradPrimary: [string, string];
  gradSuccess: [string, string];
  gradAccent: [string, string];
  /** Fat bars (rose). */
  gradFat: [string, string];
  /** Confirming actions with white text: Add to Log, Save changes. */
  gradConfirm: [string, string];

  /** CSS box-shadow strings (RN Fabric `boxShadow`). */
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  /** Under primary buttons: an indigo glow in light, a plain shadow in dark. */
  glowPrimary: string;
  /** Under confirm buttons: a green glow in light, a plain shadow in dark. */
  glowConfirm: string;
};

const light: Palette = {
  ...named,
  greenText: '#15803D', // AA-safe green for small text (§11 / §14.7)
  amberText: '#B45309', // AA-safe amber for small text (§11 / §14.7)
  track: '#E9EDF3',

  bgApp: '#F8FAFC',
  bgSurfaceSolid: '#FFFFFF',
  bgSurface: 'rgba(255,255,255,0.94)',
  bgSurfaceWarm: 'rgba(99,102,241,0.05)',
  surfaceMuted: '#F1F5F9',
  brandPrimary: '#6366F1',
  brandPrimaryStrong: '#4F46E5',
  brandFill: '#6366F1',
  textPrimary: '#111827',
  textSecondary: '#475569',
  textTertiary: '#64748B',
  textOnBrand: '#FFFFFF',
  borderSubtle: '#E2E8F0',
  borderStrong: '#CBD5E1',
  trackEmpty: '#E9EDF3',
  stateError: '#EF4444',
  errorText: '#DC2626',
  dangerTint: '#FEECEC',
  successFill: '#22C55E',

  overlayPress: 'rgba(17,24,39,0.04)',
  overlayBackdrop: 'rgba(17,24,39,0.34)',
  ringFocus: 'rgba(99,102,241,0.25)',

  chipIndigoTint: 'rgba(99,102,241,0.12)',
  chipGreenTint: 'rgba(34,197,94,0.12)',
  chipAmberTint: 'rgba(245,158,11,0.12)',
  successTint: 'rgba(34,197,94,0.10)',
  warningTint: 'rgba(245,158,11,0.10)',
  brandWash: 'rgba(99,102,241,0.04)',
  brandTint: 'rgba(99,102,241,0.10)',

  gradPrimary: ['#818CF8', '#4F46E5'],
  gradSuccess: ['#4ADE80', '#22C55E'],
  gradAccent: ['#FBBF24', '#F59E0B'],
  gradFat: ['#FB7185', '#E11D48'],
  gradConfirm: ['#15803D', '#166534'],

  shadowSm: '0px 1px 2px rgba(17,24,39,0.04), 0px 4px 12px rgba(17,24,39,0.05)',
  shadowMd: '0px 6px 18px rgba(17,24,39,0.07), 0px 2px 4px rgba(17,24,39,0.05)',
  shadowLg: '0px 18px 44px rgba(17,24,39,0.14)',
  glowPrimary: '0px 10px 24px rgba(99,102,241,0.28), 0px 2px 6px rgba(99,102,241,0.16)',
  glowConfirm: '0px 10px 24px rgba(21,128,61,0.26), 0px 2px 6px rgba(21,128,61,0.14)',
};

const dark: Palette = {
  ...named,
  greenText: '#7FD1A0',
  amberText: '#E3BC6B',
  track: '#2A2E36',

  bgApp: '#121418',
  bgSurfaceSolid: '#1B1E24',
  bgSurface: 'rgba(27,30,36,0.96)',
  bgSurfaceWarm: 'rgba(155,164,242,0.06)',
  surfaceMuted: '#24282F',
  brandPrimary: '#9BA4F2',
  brandPrimaryStrong: '#B6BDF6',
  brandFill: '#5B5FD6',
  textPrimary: '#E4E6EA',
  textSecondary: '#AEB4BF',
  textTertiary: '#838A96',
  textOnBrand: '#FFFFFF',
  borderSubtle: '#2A2E36',
  borderStrong: '#3A3F49',
  trackEmpty: '#2A2E36',
  stateError: '#E07A7A',
  errorText: '#EE9A9A',
  dangerTint: 'rgba(224,122,122,0.14)',
  successFill: '#469E6C',

  overlayPress: 'rgba(255,255,255,0.05)',
  overlayBackdrop: 'rgba(0,0,0,0.55)',
  ringFocus: 'rgba(155,164,242,0.35)',

  chipIndigoTint: 'rgba(155,164,242,0.14)',
  chipGreenTint: 'rgba(127,209,160,0.13)',
  chipAmberTint: 'rgba(227,188,107,0.13)',
  successTint: 'rgba(127,209,160,0.10)',
  warningTint: 'rgba(227,188,107,0.10)',
  brandWash: 'rgba(155,164,242,0.06)',
  brandTint: 'rgba(155,164,242,0.14)',

  gradPrimary: ['#767EE0', '#5650C8'],
  gradSuccess: ['#6CC492', '#469E6C'],
  gradAccent: ['#DDB25F', '#C2923A'],
  gradFat: ['#EC94A5', '#CF6A80'],
  gradConfirm: ['#357A54', '#2E6B4B'],

  shadowSm: '0px 1px 2px rgba(0,0,0,0.30)',
  shadowMd: '0px 4px 14px rgba(0,0,0,0.35)',
  shadowLg: '0px 18px 44px rgba(0,0,0,0.50)',
  glowPrimary: '0px 4px 12px rgba(0,0,0,0.35)',
  glowConfirm: '0px 4px 12px rgba(0,0,0,0.35)',
};

export type Scheme = 'light' | 'dark';

export const palettes: Record<Scheme, Palette> = { light, dark };
