import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FoodIcon } from '@/components/log/food-icon';
import { MealPicker } from '@/components/log/meal-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogSpace } from '@/constants/log-theme';
import { BARCODES, Barcode, MealName } from '@/data/log-mock-data';

type Phase = 'scanning' | 'found' | 'notfound' | 'manual';

type BarcodeScannerPanelProps = {
  meal: MealName;
  onMeal: (meal: MealName) => void;
  onAdd: (product: Barcode) => void;
};

export function BarcodeScannerPanel({ meal, onMeal, onAdd }: BarcodeScannerPanelProps) {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [code, setCode] = useState('');
  const [product, setProduct] = useState<Barcode | null>(null);

  useEffect(() => {
    if (phase !== 'scanning') return;
    const t = setTimeout(() => {
      setProduct(BARCODES[0]);
      setPhase('found');
    }, 1600);
    return () => clearTimeout(t);
  }, [phase]);

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

      <View style={styles.viewfinder}>
        <View style={styles.reticle}>{phase === 'scanning' && <View style={styles.scanLine} />}</View>
        <Text style={styles.statusCaption}>{phase === 'scanning' ? 'Scanning…' : phase === 'found' ? 'Product found' : 'No match'}</Text>
      </View>

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
          <MealPicker value={meal} onChange={onMeal} />
          <Button
            label={`Add ${product.amount}${product.unit} to ${meal}`}
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
    borderRadius: LogRadius.lg,
    backgroundColor: LogColor.viewfinderBg,
    overflow: 'hidden',
    marginBottom: LogSpace.lg,
    alignItems: 'center',
    justifyContent: 'center',
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
    backgroundColor: LogColor.indigo400,
    boxShadow: '0px 0px 12px 2px rgba(129,140,248,0.9)',
  },
  statusCaption: {
    position: 'absolute',
    bottom: 12,
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.micro,
    color: 'rgba(255,255,255,0.8)',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LogSpace.md,
    padding: LogSpace.md + 2,
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    borderRadius: LogRadius.md,
    marginBottom: LogSpace.lg,
  },
  productText: { flex: 1, minWidth: 0 },
  productName: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
  },
  productMeta: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    marginTop: 3,
  },
  fallbackCopy: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.small,
    color: LogColor.textSecondary,
    lineHeight: LogFontSize.small * 1.4,
    marginBottom: LogSpace.md,
  },
  manualRow: {
    flexDirection: 'row',
    gap: LogSpace.sm,
    marginTop: LogSpace.md,
  },
  manualInput: { flex: 1 },
});
