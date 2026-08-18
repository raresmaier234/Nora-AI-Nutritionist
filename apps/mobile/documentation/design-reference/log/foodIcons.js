// Maps a food name to a representative Lucide icon (via CDN) + accent color. Substitution: no brand icon set was provided.
const MAP = [
  [/banana/i, 'banana', '#D98A3D'],
  [/apple/i, 'apple', '#C25B4E'],
  [/avocado/i, 'apple', '#54744C'],
  [/chicken|turkey/i, 'drumstick', '#C4763A'],
  [/salmon|fish|tuna/i, 'fish', '#5B7FBA'],
  [/egg/i, 'egg', '#D9B23D'],
  [/yogurt|milk|cheese/i, 'milk', '#9AA6C2'],
  [/coffee|latte|espresso/i, 'coffee', '#6B4A34'],
  [/bread|toast|bagel/i, 'wheat', '#C4A15A'],
  [/salad|greens|spinach|kale/i, 'salad', '#6E8F63'],
  [/smoothie|shake|juice/i, 'cup-soda', '#8E5BB5'],
  [/rice|quinoa|oat|grain/i, 'wheat', '#C4A15A'],
  [/nut|almond|peanut/i, 'nut', '#A9743A'],
  [/pizza/i, 'pizza', '#C25B4E'],
  [/soup/i, 'soup', '#C4763A'],
  [/cookie|cake|dessert/i, 'cookie', '#A9743A'],
];
export function getFoodIcon(name) {
  const hit = MAP.find(([re]) => re.test(name));
  return hit ? { slug: hit[1], color: hit[2] } : { slug: 'utensils', color: 'var(--brand-primary-strong)' };
}
export function foodIconUrl(slug) {
  return `https://unpkg.com/lucide-static@0.462.0/icons/${slug}.svg`;
}
