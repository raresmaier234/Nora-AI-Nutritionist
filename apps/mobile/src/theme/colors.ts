/**
 * Global Nora AI Nutrition color tokens, ported from DESIGN_SYSTEM.md.
 * Token names follow §14.1 of that doc: the source CSS used `--lime-*` for indigo,
 * `--violet-*` for green and `--apricot-*` for amber — renamed here to their real colors.
 *
 * Domain-specific color semantics (e.g. macro nutrient colors) do not live here — see
 * `src/features/food/theme.ts` for those. This file holds only colors that make sense
 * outside any particular feature.
 */
export const colors = {
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
  stateError: '#EF4444',

  overlayPress: 'rgba(17,24,39,0.04)',
  overlayBackdrop: 'rgba(17,24,39,0.34)',
  ringFocus: 'rgba(99,102,241,0.25)',

  chipIndigoTint: 'rgba(99,102,241,0.12)',
  chipGreenTint: 'rgba(34,197,94,0.12)',
  chipAmberTint: 'rgba(245,158,11,0.12)',
  successTint: 'rgba(34,197,94,0.10)',
} as const;
