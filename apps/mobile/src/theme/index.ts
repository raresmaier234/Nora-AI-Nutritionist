/**
 * Global Nora AI Nutrition design tokens — the code form of DESIGN_SYSTEM.md.
 *
 *   DESIGN_SYSTEM.md → global tokens (this module) → reusable components (src/components/ui,
 *   src/components/log) → feature-specific semantics (e.g. src/features/food/theme.ts).
 *
 * Import everything from this barrel, not the individual files:
 *   import { colors, spacing, radius, fontSize, fontFamily } from '@/theme';
 */
export * from './colors';
export * from './gradients';
export * from './shadows';
export * from './radius';
export * from './spacing';
export * from './typography';
export * from './motion';
