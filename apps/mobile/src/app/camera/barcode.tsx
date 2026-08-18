import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { BarcodeScanner } from '@/features/camera';
import type { BarcodeScanResult } from '@/features/camera';

export default function BarcodeScannerRoute() {
  const router = useRouter();

  const handleScanned = useCallback(
    (result: BarcodeScanResult) => {
      router.dismissTo({
        pathname: '/',
        params: { scannedBarcodeData: result.data, scannedBarcodeType: result.type },
      });
    },
    [router]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  return <BarcodeScanner onBarcodeScanned={handleScanned} onClose={handleClose} />;
}
