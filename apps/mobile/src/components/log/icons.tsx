import type { ReactNode } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { NutrientSectionId } from '@/features/food/nutrients';

type IconProps = { size?: number; color?: string; strokeWidth?: number };

/** Line icons ported 1:1 from LogPageV3.jsx's inline <svg> markup. */

export function ChevronLeftIcon({ size = 15, color = '#475569', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 15, color = '#475569', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  );
}

export function SearchIcon({ size = 15, color = '#64748B', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={7} />
      <Path d="M21 21l-4.3-4.3" />
    </Svg>
  );
}

export function CloseIcon({ size = 11, color = '#475569', strokeWidth = 2.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M18 6 6 18M6 6l12 12" />
    </Svg>
  );
}

export function CameraIcon({ size = 15, color = '#6366F1', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 8a2 2 0 0 1 2-2h1.2l.9-1.5A1 1 0 0 1 9 4h6a1 1 0 0 1 .9.6L16.8 6H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <Circle cx={12} cy={13} r={3.5} />
    </Svg>
  );
}

export function BarcodeIcon({ size = 15, color = '#6366F1', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 5v14M8 5v14M11 5v14M14 5v14M17 5v3M17 16v3M20 5v14" />
    </Svg>
  );
}

export function RecipeIcon({ size = 15, color = '#6366F1', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.5 6.5 19.5l1-6.3L3 8.9 9 8z" />
    </Svg>
  );
}

export function PlusIcon({ size = 15, color = '#6366F1', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function CheckIcon({ size = 12, color = '#fff', strokeWidth = 3 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function SpinnerIcon({ size = 28, color = '#818CF8', strokeWidth = 2.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M12 3a9 9 0 1 0 9 9" />
    </Svg>
  );
}

export function MinusIcon({ size = 15, color = '#6366F1', strokeWidth = 2.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
      <Path d="M5 12h14" />
    </Svg>
  );
}

export function ClockIcon({ size = 15, color = '#6366F1', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function ChevronDownIcon({ size = 20, color = '#111827', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function TrashIcon({ size = 20, color = '#DC2626', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 14, color = '#64748B', strokeWidth = 2.6 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function LinkIcon({ size = 16, color = '#64748B', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <Path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </Svg>
  );
}

export function ImageIcon({ size = 20, color = '#111827', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" />
      <Circle cx={9} cy={10} r={1.8} />
      <Path d="M21 16l-5-5-8 9" />
    </Svg>
  );
}

export function PencilIcon({ size = 17, color = '#64748B', strokeWidth = 2.2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20h9" />
      <Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
  );
}

export function AlertIcon({ size = 16, color = '#B45309', strokeWidth = 2.4 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 8v4M12 16h.01" />
    </Svg>
  );
}

export function SunIcon({ size = 18, color = '#475569', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={4} />
      <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </Svg>
  );
}

export function MoonIcon({ size = 18, color = '#475569', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Svg>
  );
}

/** Half-filled circle: "follow the phone". */
export function AutoThemeIcon({ size = 18, color = '#475569', strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={9} />
      <Path d="M12 3a9 9 0 0 1 0 18z" fill={color} />
    </Svg>
  );
}

/** Food Details' nutrition section glyphs, from FoodDetailsV3.jsx (FD_SECTION_META). */
const SECTION_GLYPHS: Record<NutrientSectionId, ReactNode> = {
  macros: (
    <>
      <Path d="M21 12A9 9 0 1 1 12 3v9z" />
      <Path d="M15.5 3.7A9 9 0 0 1 20.3 8.5H15.5z" />
    </>
  ),
  sugars: (
    <>
      <Path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
      <Path d="M12 12l8-4.5M12 12v9M12 12 4 7.5" />
    </>
  ),
  fats: <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  amino: (
    <>
      <Circle cx={6} cy={12} r={2.5} />
      <Circle cx={18} cy={6} r={2.5} />
      <Circle cx={18} cy={18} r={2.5} />
      <Path d="M8.3 10.9l7.4-3.8M8.3 13.1l7.4 3.8" />
    </>
  ),
  vitamins: (
    <>
      <Path d="M10.5 20.5 3.5 13.5a4.95 4.95 0 1 1 7-7l7 7a4.95 4.95 0 1 1-7 7z" />
      <Path d="M8.5 8.5l7 7" />
    </>
  ),
  minerals: (
    <>
      <Path d="M6 3h12l4 6-10 12L2 9z" />
      <Path d="M2 9h20M12 21 8 9l4-6 4 6-4 12" />
    </>
  ),
  other: (
    <>
      <Path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
      <Path d="M7 15h10" />
    </>
  ),
};

export function NutrientSectionIcon({ section, size = 21, color = '#475569', strokeWidth = 2 }: IconProps & { section: NutrientSectionId }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {SECTION_GLYPHS[section]}
    </Svg>
  );
}
