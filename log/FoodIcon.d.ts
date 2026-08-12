/**
 * Beautiful, colorful, representative food icon (Twemoji CDN illustrations, matched by keyword from the food name) inside a softly tinted rounded container — the visual identity of the food diary. `foodIllustration(name)` returns the raw {src,tint} for custom layouts.
 * @startingPoint section="Mobile App v2" subtitle="Colorful illustrated food icon" viewport="60x60"
 */
export interface FoodIconProps {
  name: string;
  /** Container diameter in px; defaults to 48. */
  size?: number;
}
export function FoodIcon(props: FoodIconProps): JSX.Element;
export interface FoodIllustration { src: string; tint: 'indigo' | 'green' | 'amber' | 'neutral'; }
export function foodIllustration(name: string): FoodIllustration;
