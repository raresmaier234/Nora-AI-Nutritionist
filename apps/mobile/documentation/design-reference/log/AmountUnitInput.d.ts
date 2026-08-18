/**
 * Amount number field + unit dropdown (g, oz, slice, piece, cup, serving) for manually specifying how much of a food was logged. Also exports `unitToGrams(amount, unit)` and `UNIT_OPTIONS` for gram conversion.
 * @startingPoint section="Mobile App" subtitle="Quantity + unit picker for logging food" viewport="300x50"
 */
export interface UnitOption { label: string; grams: number; }
export interface Amount { amount: number; unit: string; }
export interface AmountUnitInputProps {
  amount: number;
  unit: string;
  onChange?: (value: Amount) => void;
}
export function AmountUnitInput(props: AmountUnitInputProps): JSX.Element;
export function unitToGrams(amount: number, unit: string): number;
export const UNIT_OPTIONS: UnitOption[];
