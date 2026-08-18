/**
 * Compact icon-over-label action card used in a row for "Take Photo" / "Create Meal" on the Log screen.
 * @startingPoint section="Mobile App" subtitle="Icon quick-action card" viewport="180x100"
 */
export interface QuickActionButtonProps {
  icon: 'camera' | 'plus';
  label: string;
  onClick?: () => void;
}
export function QuickActionButton(props: QuickActionButtonProps): JSX.Element;
