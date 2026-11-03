import { lookupBarcode } from '@/services/api';
import { Food } from '@/features/food/data/mock-data';

/** A scanned product as the Log's food, and the grams of the serving its package states. */
export type ScannedFood = { food: Food; grams: number | null };

/**
 * The loggable database food a barcode belongs to, or null when there is none. Network errors
 * reject, so a caller can tell "not found" from "couldn't ask".
 */
export async function findScannedFood(code: string): Promise<ScannedFood | null> {
  const digits = code.trim();
  if (!/^\d{8,14}$/.test(digits)) return null;
  const detail = await lookupBarcode(digits);
  if (!detail?.per_100g) return null;
  return {
    food: { id: String(detail.id), name: detail.name, brand: detail.brand, store: detail.store, per100: detail.per_100g },
    grams: detail.package_serving?.grams ?? null,
  };
}
