import React from 'react';
// Food → colorful illustrated icon (Twemoji CDN) + soft tinted container, matched by keyword.
const NOTO = (hex) => `https://fonts.gstatic.com/s/e/notoemoji/latest/${hex}/emoji.svg`;
const MAP = [
  [/yogurt/i, NOTO('1f963'), 'indigo'],
  [/banana/i, NOTO('1f34c'), 'amber'],
  [/almond|nut/i, NOTO('1f95c'), 'amber'],
  [/chicken/i, NOTO('1f357'), 'green'],
  [/rice/i, NOTO('1f35a'), 'neutral'],
  [/salad/i, NOTO('1f957'), 'green'],
  [/salmon|fish|tuna/i, NOTO('1f41f'), 'indigo'],
  [/vegetable|broccoli|greens/i, NOTO('1f966'), 'green'],
  [/apple/i, NOTO('1f34e'), 'indigo'],
  [/egg/i, NOTO('1f95a'), 'amber'],
  [/bread|toast|oat/i, NOTO('1f35e'), 'amber'],
  [/avocado/i, NOTO('1f951'), 'green'],
  [/milk|cheese/i, NOTO('1f95b'), 'indigo'],
  [/coffee/i, NOTO('2615'), 'neutral'],
  [/smoothie|shake|juice/i, NOTO('1f379'), 'indigo'],
  [/quinoa|grain/i, NOTO('1f35a'), 'neutral'],
];
const TINTS = {
  indigo: { bg: 'rgba(99,102,241,0.12)' },
  green: { bg: 'rgba(34,197,94,0.12)' },
  amber: { bg: 'rgba(245,158,11,0.12)' },
  neutral: { bg: '#F1F5F9' },
};
export function foodIllustration(name) {
  const hit = MAP.find(([re]) => re.test(name));
  return hit ? { src: hit[1], tint: hit[2] } : { src: NOTO('1f37d-fe0f'), tint: 'neutral' };
}
export function FoodIcon({ name, size }) {
  const s = size || 48;
  const ic = foodIllustration(name);
  const t = TINTS[ic.tint] || TINTS.neutral;
  return (
    <div style={{ width: s, height: s, borderRadius: s * 0.42, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <img src={ic.src} alt="" width={s * 0.52} height={s * 0.52} style={{ display: 'block' }} />
    </div>
  );
}
