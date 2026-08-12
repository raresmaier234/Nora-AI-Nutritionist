/**
 * Bottom sheet showing a food's detail: image placeholder, name, and kcal/protein/carbs/fat — read-only for a searched food, or editable fields when creating a meal or confirming a photo estimate. When `food.per100` is present (per-100g base values), shows an amount + unit (g/oz/slice/piece/cup/serving) picker and live-recalculates macros from the chosen quantity instead of exposing raw macro inputs.
 * @startingPoint section="Mobile App" subtitle="Food detail / confirm bottom sheet" viewport="380x400"
 */
export interface FoodDetail { name: string; kcal: number; protein: number; carbs: number; fat: number; amount?: number; unit?: string; per100?: { kcal: number; protein: number; carbs: number; fat: number }; }
export interface FoodDetailSheetProps {
  food: FoodDetail;
  /** When true, name and macro fields become editable inputs (create-meal / confirm-estimate flows). */
  editable?: boolean;
  onChange?: (food: FoodDetail) => void;
  onClose?: () => void;
  onConfirm?: () => void;
  /** Label for the bottom action button; defaults to "Add to log". */
  confirmLabel?: string;
}
export function FoodDetailSheet(props: FoodDetailSheetProps): JSX.Element;
