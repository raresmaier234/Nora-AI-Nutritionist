/**
 * Nutrition-domain color semantics — not global design tokens, since they only make sense
 * in the context of food-logging UI (macro roles, the scan/photo capture viewfinder).
 *
 * Values match the canonical macro→color mapping in DESIGN_SYSTEM.md §2.4 (protein=indigo,
 * carbs=amber, fat=green) and are derived from the global palette rather than re-declared,
 * so they can never drift from it — this file only adds domain-specific *names* for colors
 * that already exist in `@/theme`.
 */
import { colors } from '@/theme';

export const nutritionColors = {
  accentProtein: colors.indigo500,
  accentCarbs: colors.amber500,
  warnFat: colors.green500,
} as const;

/** Camera viewfinder background for the barcode-scan and photo-estimate flows. */
export const viewfinderBg = colors.slate900;

/**
 * Nutrient-family palette from the design system's tokens/nutrition.css — one soft identity
 * per family. `base` = bars, dots, rings · `ink` = text on white or tint (AA) · `tint` = soft
 * card backgrounds. Used by the Food Details screen.
 */
export const nutrientFamily = {
  kcal: { base: '#FF7A59', ink: '#C2410C', tint: '#FFF1EC' },
  protein: { base: '#6366F1', ink: '#4338CA', tint: '#EEF0FF' },
  carbs: { base: '#F59E0B', ink: '#B45309', tint: '#FEF6E4' },
  fat: { base: '#22C55E', ink: '#15803D', tint: '#E9F9EF' },
  fiber: { base: '#14B8A6', ink: '#0F766E', tint: '#E6F7F5' },
  vitamin: { base: '#A78BFA', ink: '#6D28D9', tint: '#F3EFFF' },
  mineral: { base: '#38BDF8', ink: '#0369A1', tint: '#E8F6FE' },
  other: { base: '#94A3B8', ink: '#475569', tint: '#F1F5F9' },
} as const;

export type NutrientFamily = keyof typeof nutrientFamily;

/** Over-target red used for "N over" copy and over-limit bars. */
export const overInk = '#DC2626';
