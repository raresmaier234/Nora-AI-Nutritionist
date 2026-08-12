/**
 * One ingredient line in the recipe builder: icon, name, an editable amount+unit picker (g/oz/slice/piece/cup/serving), computed kcal, and a remove button.
 * @startingPoint section="Mobile App" subtitle="Editable recipe ingredient row" viewport="340x64"
 */
export interface IngredientIcon { slug: string; color: string; }
export interface Qty { amount: number; unit: string; }
export interface IngredientRowProps {
  name: string;
  icon: IngredientIcon;
  amount: number;
  unit: string;
  kcal: number;
  onQtyChange?: (qty: Qty) => void;
  onRemove?: () => void;
}
export function IngredientRow(props: IngredientRowProps): JSX.Element;
