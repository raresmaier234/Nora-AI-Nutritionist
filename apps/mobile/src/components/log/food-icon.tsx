import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { colors, fontFamily } from '@/theme';
import { FoodTint, GENERIC_FOOD_ICON, foodIllustration } from '@/features/food/food-icons';

/**
 * Food → colorful illustrated icon (Noto Emoji CDN) inside a softly tinted rounded container.
 * Ported from log/FoodIcon.jsx: the icon is chosen by `foodIllustration` (see
 * `@/features/food/food-icons`), rendered via react-native-svg's SvgXml instead of an <img> tag.
 */

export { foodIllustration };

const TINT_BG: Record<FoodTint, string> = {
  indigo: colors.chipIndigoTint,
  green: colors.chipGreenTint,
  amber: colors.chipAmberTint,
  neutral: colors.slate100,
};

// Some Noto files (🍴 the generic icon, 🍩, 🍨, 🧈, …) are Illustrator exports with a
// `<!DOCTYPE … [ <!ENTITY …> ]>` block, which react-native-svg's parser rejects. The drawing
// doesn't need it, so it is removed.
const stripDoctype = (xml: string) => xml.replace(/<!DOCTYPE[^[>]*(\[[\s\S]*?\])?\s*>/i, '');

// One download per icon for the whole app: every row showing the same food shares it, and a
// re-render never fetches again. A failed download is forgotten so the next mount retries.
const svgCache = new Map<string, Promise<string>>();

function loadSvg(uri: string): Promise<string> {
  let pending = svgCache.get(uri);
  if (!pending) {
    pending = fetch(uri)
      .then((r) => {
        if (!r.ok) throw new Error(`Fetching ${uri} failed with status ${r.status}`);
        return r.text();
      })
      .then(stripDoctype);
    pending.catch(() => svgCache.delete(uri));
    svgCache.set(uri, pending);
  }
  return pending;
}

/** The food's own icon, then the generic one; null once every source has failed. */
async function loadFirst(sources: string[]): Promise<string | null> {
  for (const uri of sources) {
    try {
      return await loadSvg(uri);
    } catch {
      // try the next source
    }
  }
  return null;
}

const ignoreParseError = () => {};

type FoodIconProps = {
  /** Food name, used for keyword matching. Optional when `category` is given. */
  name?: string;
  /** Category id or label; used when no specific food icon matches `name`. */
  category?: string;
  /** Container size in px; defaults to 48. */
  size?: number;
  /** Force the generic fork & knife icon (custom meals, empty states). */
  generic?: boolean;
};

export function FoodIcon({ name = '', category, size = 48, generic }: FoodIconProps) {
  const ic = generic
    ? { src: GENERIC_FOOD_ICON, tint: 'indigo' as const, fallback: GENERIC_FOOD_ICON }
    : foodIllustration(name, category);
  const glyphSize = size * 0.52;
  const [svg, setSvg] = useState<{ src: string; xml: string | null; failed: boolean }>({ src: ic.src, xml: null, failed: false });

  useEffect(() => {
    let cancelled = false;
    loadFirst(ic.src === ic.fallback ? [ic.src] : [ic.src, ic.fallback]).then((xml) => {
      if (!cancelled) setSvg({ src: ic.src, xml, failed: xml === null });
    });
    return () => {
      cancelled = true;
    };
  }, [ic.src, ic.fallback]);

  const current = svg.src === ic.src ? svg : { xml: null, failed: false };
  // The icon is decoration: if nothing loads (offline, CDN down), show the food's initial
  // rather than an error.
  const initial = <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{name.trim().charAt(0).toUpperCase()}</Text>;

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size * 0.42, backgroundColor: TINT_BG[ic.tint] },
      ]}>
      {current.failed ? (
        initial
      ) : current.xml ? (
        <SvgXml
          xml={current.xml}
          width={glyphSize}
          height={glyphSize}
          // SvgXml reports a parse error during render and shows `fallback` itself; without an
          // onError it would also console.error, which is a red box in development.
          onError={ignoreParseError}
          fallback={initial}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initial: {
    fontFamily: fontFamily.bold,
    color: colors.textSecondary,
  },
});
