import Svg, { Circle, Path } from 'react-native-svg';

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
