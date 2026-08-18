// RN's Fabric renderer accepts a CSS box-shadow string (including multiple layers) via `boxShadow`.
export const shadows = {
  sm: '0px 1px 2px rgba(17,24,39,0.04), 0px 4px 12px rgba(17,24,39,0.05)',
  md: '0px 6px 18px rgba(17,24,39,0.07), 0px 2px 4px rgba(17,24,39,0.05)',
  lg: '0px 18px 44px rgba(17,24,39,0.14)',
  glowPrimary: '0px 10px 24px rgba(99,102,241,0.28), 0px 2px 6px rgba(99,102,241,0.16)',
} as const;
