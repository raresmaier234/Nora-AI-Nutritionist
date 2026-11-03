/** Kilocalories in a kilogram of body fat, the usual rule of thumb. */
export const KCAL_PER_KG = 7700;

/** A day "on target": calories within 10% of the target either way. */
export const isOnTarget = (kcal: number, target: number) => Math.abs(kcal - target) <= target * 0.1;

/** "0.3 kg", or "under 0.1 kg" for a balance too small to round to one. */
export function kgFrom(kcal: number): string {
  const kg = Math.abs(kcal) / KCAL_PER_KG;
  return kg < 0.05 ? 'under 0.1 kg' : `${kg.toFixed(1)} kg`;
}
