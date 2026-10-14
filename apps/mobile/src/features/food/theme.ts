/**
 * Nutrition-domain color semantics — not global design tokens, since they only make sense
 * in the context of food-logging UI (macro roles, nutrient families, the camera viewfinder).
 * Like the global palette, each has a light and a dark version; read them with
 * `useFoodColors()` or `foodColors[scheme]` inside a `makeStyles` factory.
 */
import { Scheme, palettes, useTheme } from '@/theme';

export type NutrientFamily = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'vitamin' | 'mineral' | 'other';
type Swatch = { base: string; ink: string; tint: string };

/**
 * Nutrient-family palette from the design system's tokens/nutrition.css — one soft identity
 * per family. `base` = bars, dots, rings · `ink` = text on white or tint (AA) · `tint` = soft
 * card backgrounds. The dark set is desaturated (saturated hues vibrate on dark), with lighter
 * `ink` and a translucent `tint`.
 */
const nutrientLight: Record<NutrientFamily, Swatch> = {
  kcal: { base: '#FF7A59', ink: '#C2410C', tint: '#FFF1EC' },
  protein: { base: '#6366F1', ink: '#4338CA', tint: '#EEF0FF' },
  carbs: { base: '#F59E0B', ink: '#B45309', tint: '#FEF6E4' },
  fat: { base: '#F43F5E', ink: '#BE123C', tint: '#FFF1F3' },
  fiber: { base: '#14B8A6', ink: '#0F766E', tint: '#E6F7F5' },
  vitamin: { base: '#A78BFA', ink: '#6D28D9', tint: '#F3EFFF' },
  mineral: { base: '#38BDF8', ink: '#0369A1', tint: '#E8F6FE' },
  other: { base: '#94A3B8', ink: '#475569', tint: '#F1F5F9' },
};

const nutrientDark: Record<NutrientFamily, Swatch> = {
  kcal: { base: '#E8876B', ink: '#F2A68F', tint: 'rgba(232,135,107,0.12)' },
  protein: { base: '#9BA4F2', ink: '#B6BDF6', tint: 'rgba(155,164,242,0.12)' },
  carbs: { base: '#E3B45A', ink: '#EBC883', tint: 'rgba(227,180,90,0.12)' },
  fat: { base: '#E8798F', ink: '#F2A3B3', tint: 'rgba(232,121,143,0.12)' },
  fiber: { base: '#4FBFAE', ink: '#7FD3C5', tint: 'rgba(79,191,174,0.12)' },
  vitamin: { base: '#AD97EE', ink: '#C6B7F3', tint: 'rgba(173,151,238,0.12)' },
  mineral: { base: '#5FB4DC', ink: '#8DCBE8', tint: 'rgba(95,180,220,0.12)' },
  other: { base: '#7B8494', ink: '#B3BAC5', tint: 'rgba(123,132,148,0.12)' },
};

export type FoodColors = {
  /** Nutrient families: Food Details, Recipe Studio. */
  nu: Record<NutrientFamily, Swatch>;
  /**
   * Macro colors: protein = indigo, carbs = amber, fat = rose. Deliberately differs from the
   * design system's mapping (DESIGN_SYSTEM.md §2.4, fat = green): green also means "remaining"
   * and "done", so fat was hard to tell apart.
   */
  accentProtein: string;
  accentCarbs: string;
  warnFat: string;
};

export const foodColors: Record<Scheme, FoodColors> = {
  light: {
    nu: nutrientLight,
    accentProtein: nutrientLight.protein.base,
    accentCarbs: nutrientLight.carbs.base,
    warnFat: nutrientLight.fat.base,
  },
  dark: {
    nu: nutrientDark,
    accentProtein: nutrientDark.protein.base,
    accentCarbs: nutrientDark.carbs.base,
    warnFat: nutrientDark.fat.base,
  },
};

export const useFoodColors = (): FoodColors => foodColors[useTheme().scheme];

/** Camera viewfinder background for the barcode-scan and photo-estimate flows — dark in both themes. */
export const viewfinderBg = palettes.light.slate900;
