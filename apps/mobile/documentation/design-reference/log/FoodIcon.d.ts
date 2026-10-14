/**
 * Colorful, representative food icon (Noto Emoji CDN illustrations) inside a softly tinted rounded container — the visual identity of the food diary. Resolves a specific food icon by keyword from `name` first (Banana → banana), then falls back to the food's category icon (explicit `category`, else keyword-matched), then "Other". `FoodCategoryIcon` renders the 10 category icons as selectable tiles.
 * @startingPoint section="Mobile App v2" subtitle="Colorful illustrated food + category icons" viewport="60x60"
 */
export type FoodCategoryId = 'baked' | 'meat' | 'veg' | 'seafood' | 'fruit' | 'nuts' | 'dairy' | 'drinks' | 'sweets' | 'other';
export interface FoodCategoryItem { name: string; src: string; match: RegExp; }
export interface FoodCategory {
  id: FoodCategoryId;
  /** Display label: Baked Goods, Meats, Vegetables, Seafood, Fruit, Nuts and Seeds, Dairy and Eggs, Drinks, Sweets, Other. */
  label: string;
  /** The category's own representative icon. */
  src: string;
  tint: 'indigo' | 'green' | 'amber' | 'neutral';
  /** Fallback keywords used when no specific item matches. */
  keywords: RegExp | null;
  /** Specific food icons in this category (≈115 total across all categories). */
  items: FoodCategoryItem[];
}
export const FOOD_CATEGORIES: FoodCategory[];

export interface FoodIconProps {
  /** Food name, used for keyword matching. Optional when `category` is given. */
  name?: string;
  /** Category id or label; used when no specific food icon matches `name`. */
  category?: FoodCategoryId | string;
  /** Container size in px; defaults to 48. */
  size?: number;
  /** Force the generic fork & knife icon (custom meals). Unmatched names get it automatically. */
  generic?: boolean;
}
export function FoodIcon(props: FoodIconProps): JSX.Element;
/** Fork & knife illustration URL used for custom meals and unrecognised foods. */
export const GENERIC_FOOD_ICON: string;

export interface FoodCategoryIconProps {
  /** Category id or label, e.g. 'seafood' or 'Seafood'. */
  category: FoodCategoryId | string;
  /** Icon container size in px; defaults to 52. */
  size?: number;
  /** Selected state — indigo ring + tint, indigo label. */
  selected?: boolean;
  /** Show the label under the icon; defaults to true. */
  showLabel?: boolean;
  /** Makes the tile a pressable button. */
  onClick?: () => void;
}
export function FoodCategoryIcon(props: FoodCategoryIconProps): JSX.Element;

export interface FoodIllustration { src: string; tint: 'indigo' | 'green' | 'amber' | 'neutral'; category: FoodCategoryId; fallback: string; }
export function foodIllustration(name?: string, category?: string): FoodIllustration;
export function categorizeFood(name?: string): FoodCategory;
