import type { BarcodeScanningResult, BarcodeType } from 'expo-camera';
import { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CameraView } from '@/features/camera/components/CameraView';
import { FOOD_BARCODE_TYPES, type BarcodeScanResult } from '@/features/camera/types/camera';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

type BarcodeScannerProps = {
  onBarcodeScanned: (result: BarcodeScanResult) => void;
  onClose: () => void;
};

/** Full-screen barcode scanner. Fires `onBarcodeScanned` at most once per mount. */
export function BarcodeScanner({ onBarcodeScanned, onClose }: BarcodeScannerProps) {
  const hasScannedRef = useRef(false);

  const handleScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;
      onBarcodeScanned({ data: result.data, type: result.type as BarcodeType });
    },
    [onBarcodeScanned]
  );

  return (
    <CameraView
      onClose={onClose}
      barcodeScannerSettings={{ barcodeTypes: FOOD_BARCODE_TYPES }}
      onBarcodeScanned={handleScanned}
      permissionTitle="Camera access needed"
      permissionDescription="Nora needs camera access to scan product barcodes.">
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.centerColumn}>
          <View style={styles.reticle}>
            <View style={styles.scanLine} />
          </View>
          <Text style={styles.hint}>Align the barcode within the frame</Text>
        </View>
      </View>
    </CameraView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerColumn: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  reticle: {
    width: 200,
    height: 104,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.75)',
    borderRadius: 12,
    justifyContent: 'center',
  },
  scanLine: {
    height: 2,
    backgroundColor: colors.indigo400,
    boxShadow: '0px 0px 12px 2px rgba(129,140,248,0.9)',
  },
  hint: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: 'rgba(255,255,255,0.8)',
  },
});
