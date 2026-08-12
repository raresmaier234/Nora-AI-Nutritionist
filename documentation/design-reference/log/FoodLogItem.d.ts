/**
 * One row in the hour-grouped food log: icon, food name, logged time, and kcal — taps open the food's detail sheet.
 * @startingPoint section="Mobile App" subtitle="Hourly food log row" viewport="340x60"
 */
export interface FoodIconRef { slug: string; color: string; }
export interface FoodLogItemProps {
  name: string;
  time: string;
  kcal: number;
  /** Override the auto-matched food icon (matched from `name` via a keyword map otherwise). */
  icon?: FoodIconRef;
  onClick?: () => void;
}
export function FoodLogItem(props: FoodLogItemProps): JSX.Element;
