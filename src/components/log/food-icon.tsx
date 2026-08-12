import { StyleSheet, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import { LogColor } from '@/constants/log-theme';

/**
 * Food → colorful illustrated icon (Noto Emoji CDN) inside a softly tinted rounded container.
 * Ported from log/FoodIcon.jsx — same keyword map, same CDN, same tint set — rendered via
 * react-native-svg's SvgUri instead of an <img> tag.
 */

const noto = (hex: string) => `https://fonts.gstatic.com/s/e/notoemoji/latest/${hex}/emoji.svg`;

type Tint = 'indigo' | 'green' | 'amber' | 'neutral';

const KEYWORD_MAP: Array<[RegExp, string, Tint]> = [
  [/yogurt/i, noto('1f963'), 'indigo'],
  [/banana/i, noto('1f34c'), 'amber'],
  [/almond|nut/i, noto('1f95c'), 'amber'],
  [/chicken/i, noto('1f357'), 'green'],
  [/rice/i, noto('1f35a'), 'neutral'],
  [/salad/i, noto('1f957'), 'green'],
  [/salmon|fish|tuna/i, noto('1f41f'), 'indigo'],
  [/vegetable|broccoli|greens/i, noto('1f966'), 'green'],
  [/apple/i, noto('1f34e'), 'indigo'],
  [/egg/i, noto('1f95a'), 'amber'],
  [/bread|toast|oat/i, noto('1f35e'), 'amber'],
  [/avocado/i, noto('1f951'), 'green'],
  [/milk|cheese/i, noto('1f95b'), 'indigo'],
  [/coffee/i, noto('2615'), 'neutral'],
  [/smoothie|shake|juice/i, noto('1f379'), 'indigo'],
  [/quinoa|grain/i, noto('1f35a'), 'neutral'],
];

const TINT_BG: Record<Tint, string> = {
  indigo: LogColor.chipIndigoTint,
  green: LogColor.chipGreenTint,
  amber: LogColor.chipAmberTint,
  neutral: LogColor.slate100,
};

export function foodIllustration(name: string): { uri: string; tint: Tint } {
  const hit = KEYWORD_MAP.find(([re]) => re.test(name));
  return hit ? { uri: hit[1], tint: hit[2] } : { uri: noto('1f37d-fe0f'), tint: 'neutral' };
}

type FoodIconProps = { name: string; size?: number };

export function FoodIcon({ name, size = 48 }: FoodIconProps) {
  const { uri, tint } = foodIllustration(name);
  const glyphSize = size * 0.52;
  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size * 0.42, backgroundColor: TINT_BG[tint] },
      ]}>
      <SvgUri uri={uri} width={glyphSize} height={glyphSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
