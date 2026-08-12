/**
 * Pill search field with a leading magnifier icon, focus ring, and a clear button once text is entered.
 * @startingPoint section="Mobile App" subtitle="Food search input" viewport="380x50"
 */
export interface SearchBarProps {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}
export function SearchBar(props: SearchBarProps): JSX.Element;
