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
