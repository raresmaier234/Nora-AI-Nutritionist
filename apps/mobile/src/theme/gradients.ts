/**
 * Direction for expo-linear-gradient's <LinearGradient start/end />. The gradient colors
 * themselves are theme tokens (`colors.gradPrimary`, …) — see ./colors.ts.
 *
 * RN's `experimental_backgroundImage` CSS-string style does not render reliably across
 * platforms, so gradients go through an actual <LinearGradient> component instead.
 */
export const gradientAngle = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;
