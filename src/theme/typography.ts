export const fontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

export const fontSize = {
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

/** letterSpacing tokens are defined in em in the source; RN's letterSpacing is absolute px. */
export const trackTight = (fontSize: number) => Math.round(fontSize * -0.03 * 100) / 100;
export const trackSnug = (fontSize: number) => Math.round(fontSize * -0.015 * 100) / 100;
export const trackWide = (fontSize: number) => Math.round(fontSize * 0.08 * 100) / 100;
