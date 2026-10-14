/**
 * Global Nora AI Nutrition design tokens — the code form of DESIGN_SYSTEM.md.
 *
 *   DESIGN_SYSTEM.md → global tokens (this module) → reusable components (src/components/ui,
 *   src/components/log) → feature-specific semantics (e.g. src/features/food/theme.ts).
 *
 * Import everything from this barrel, not the individual files:
 *   import { useStyles, Palette, spacing, radius, fontSize, fontFamily } from '@/theme';
 *
 * Colors depend on light/dark mode, so they are read at render time — `useColors()` in a
 * component, or `const makeStyles = (colors: Palette) => StyleSheet.create({...})` with
 * `const styles = useStyles(makeStyles)`. There is no static `colors` export on purpose.
 */
export * from './colors';
export * from './use-theme';
export * from './gradients';
export * from './radius';
export * from './spacing';
export * from './typography';
export * from './motion';
