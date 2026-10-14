import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CameraIcon } from '@/components/log/icons';
import { FoodIcon } from '@/components/log/food-icon';
import { WhenPicker } from '@/components/log/when-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { BARCODES, Barcode } from '@/features/food/data/mock-data';
import { viewfinderBg } from '@/features/food/theme';
import type { BarcodeScanResult } from '@/features/camera';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

type Phase = 'ready' | 'found' | 'notfound' | 'manual';

type BarcodeScannerPanelProps = {
  /** "HH:MM" eaten. */
  time: string;
  onTime: (time: string) => void;
  onAdd: (product: Barcode) => void;
  /** Opens the full-screen camera route (src/app/camera/barcode.tsx). */
  onOpenCamera: () => void;
  /** Populated once the camera round-trip returns a scanned code; null before then. */
  scanResult: BarcodeScanResult | null;
};

export function BarcodeScannerPanel({ time, onTime, onAdd, onOpenCamera, scanResult }: BarcodeScannerPanelProps) {
  const initialHit = scanResult ? (BARCODES.find((b) => b.code === scanResult.data) ?? null) : null;
  const [phase, setPhase] = useState<Phase>(() => {
    if (!scanResult) return 'ready';
    return initialHit ? 'found' : 'notfound';
  });
  const [code, setCode] = useState('');
  const [product, setProduct] = useState<Barcode | null>(initialHit);

  const lookup = () => {
    const hit = BARCODES.find((b) => b.code === code.trim());
    if (hit) {
      setProduct(hit);
      setPhase('found');
    } else {
      setProduct(null);
      setPhase('notfound');
    }
  };

  return (
    <View>
      <SheetTitle>Scan barcode</SheetTitle>
      <SheetSubtitle>Point your camera at the product barcode</SheetSubtitle>

      {phase === 'ready' ? (
        <Pressable
          onPress={onOpenCamera}
          accessibilityRole="button"
          accessibilityLabel="Open camera to scan barcode"
          style={styles.viewfinder}>
          <View style={styles.centerCol}>
            <CameraIcon size={30} color="rgba(255,255,255,0.85)" strokeWidth={1.7} />
            <Text style={styles.hintText}>Tap to scan with camera</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.viewfinder}>
          <View style={styles.reticle} />
          <Text style={styles.statusCaption}>{phase === 'found' ? 'Product found' : 'No match'}</Text>
        </View>
      )}

      {phase === 'found' && product ? (
        <>
          <View style={styles.productRow}>
            <FoodIcon name={product.name} size={44} />
            <View style={styles.productText}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productMeta}>
                {product.code} · {product.per100.kcal} kcal/100g
              </Text>
            </View>
          </View>
          <WhenPicker value={time} onChange={onTime} />
          <Button
            label={`Add ${product.amount}${product.unit} at ${time}`}
            onPress={() => onAdd(product)}
          />
        </>
      ) : null}

      {phase === 'notfound' || phase === 'manual' ? (
        <Text style={styles.fallbackCopy}>That barcode isn&apos;t in the database yet — enter it manually or create a custom food.</Text>
      ) : null}

      <View style={styles.manualRow}>
        <Field style={styles.manualInput} value={code} onChangeText={setCode} placeholder="Enter barcode number" keyboardType="numeric" />
        <Button label="Look up" variant="secondary" onPress={lookup} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewfinder: {
    height: 168,
    borderRadius: radius.lg,
    backgroundColor: viewfinderBg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCol: { alignItems: 'center', gap: spacing.md },
  hintText: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: 'rgba(255,255,255,0.85)',
  },
  reticle: {
    width: 200,
    height: 104,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.75)',
    borderRadius: 12,
    justifyContent: 'center',
  },
  statusCaption: {
    position: 'absolute',
    bottom: 12,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.micro,
    color: 'rgba(255,255,255,0.8)',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md + 2,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  productText: { flex: 1, minWidth: 0 },
  productName: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
  productMeta: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    marginTop: 3,
  },
  fallbackCopy: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.small,
    color: colors.textSecondary,
    lineHeight: fontSize.small * 1.4,
    marginBottom: spacing.md,
  },
  manualRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  manualInput: { flex: 1 },
});
