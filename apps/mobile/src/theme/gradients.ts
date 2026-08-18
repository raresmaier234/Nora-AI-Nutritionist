/**
 * Gradient color stops for expo-linear-gradient's <LinearGradient colors={...} />.
 * RN's `experimental_backgroundImage` CSS-string style does not render reliably across
 * platforms, so gradients go through an actual <LinearGradient> component instead.
 */
export const gradients = {
  primary: ['#818CF8', '#4F46E5'] as [string, string], // buttons, active pills, water fill, protein bar
  success: ['#4ADE80', '#22C55E'] as [string, string], // calorie progress, fat bar
  accent: ['#FBBF24', '#F59E0B'] as [string, string], // carbs bar
} as const;

export const gradientAngle = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
