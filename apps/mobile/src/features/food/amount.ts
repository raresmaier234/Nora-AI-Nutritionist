/**
 * Amounts as people write them: "1,5" (a Romanian keypad), "1/4", "1 1/2", "½", "1½" — and back
 * the other way, so a logged 0.25 cup reads "¼ cup".
 */

/** The fractions kitchen measures come in, with their glyphs. */
export const FRACTIONS: [number, string][] = [
  [1 / 8, '⅛'],
  [1 / 4, '¼'],
  [1 / 3, '⅓'],
  [1 / 2, '½'],
  [2 / 3, '⅔'],
  [3 / 4, '¾'],
];

const GLYPHS = new Map(FRACTIONS.map(([value, glyph]) => [glyph, value]));

/** The amount in `text`, or 0 when it isn't one. */
export function parseAmount(text: string): number {
  const t = text.trim().replace(',', '.');
  // "1½", "½"
  const glyph = t.match(/^(\d+)?\s*([⅛¼⅓½⅔¾])$/);
  if (glyph) return Number(glyph[1] ?? 0) + (GLYPHS.get(glyph[2]) ?? 0);
  // "1 1/2", "1/4"
  const fraction = t.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (fraction) {
    const [, whole, top, bottom] = fraction;
    return Number(bottom) > 0 ? Number(whole ?? 0) + Number(top) / Number(bottom) : 0;
  }
  return Math.max(0, Number(t) || 0);
}

/** 0.25 → "¼", 1.5 → "1½", 0.33 → "⅓", 2.4 → "2.4": a fraction glyph when the amount is one. */
export function formatAmount(value: number): string {
  const whole = Math.floor(value + 0.005);
  const rest = value - whole;
  if (rest < 0.01) return String(whole);
  const match = FRACTIONS.find(([fraction]) => Math.abs(rest - fraction) < 0.01);
  if (match) return whole ? `${whole}${match[1]}` : match[1];
  return String(Math.round(value * 100) / 100);
}

/** The amount as the in-app keypad types it: 1.5 → "1 1/2", 0.25 → "1/4", 2.4 → "2.4". */
export function typedAmount(value: number): string {
  const whole = Math.floor(value + 0.005);
  const rest = value - whole;
  if (rest < 0.01) return String(whole);
  const match = FRACTIONS.find(([fraction]) => Math.abs(rest - fraction) < 0.01);
  if (!match) return String(Math.round(value * 100) / 100);
  const [top, bottom] = { '⅛': [1, 8], '¼': [1, 4], '⅓': [1, 3], '½': [1, 2], '⅔': [2, 3], '¾': [3, 4] }[match[1]] ?? [0, 1];
  return whole ? `${whole} ${top}/${bottom}` : `${top}/${bottom}`;
}
