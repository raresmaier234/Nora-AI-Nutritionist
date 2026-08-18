import type { BarcodeType } from 'expo-camera';

/** Result handed back to whatever screen opened the barcode scanner. */
export type BarcodeScanResult = {
  data: string;
  type: BarcodeType;
};

/** Result handed back to whatever screen opened the photo capture flow. */
export type PhotoCaptureResult = {
  uri: string;
};

/**
 * Normalized camera permission state:
 * - `checking`     — the hook hasn't resolved the initial status yet
 * - `undetermined`  — never asked; show a "grant access" prompt
 * - `granted`       — camera is usable
 * - `denied`        — user said no, but can still be asked again
 * - `blocked`       — user said no and iOS/Android won't prompt again; must go to Settings
 */
export type CameraPermissionState = 'checking' | 'undetermined' | 'granted' | 'denied' | 'blocked';

/** Retail product barcode formats relevant to scanning food packaging, plus QR as a common extra. */
export const FOOD_BARCODE_TYPES: BarcodeType[] = ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'];
