import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CameraIcon } from '@/components/log/icons';
import { WhenPicker } from '@/components/log/when-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { Food } from '@/features/food/data/mock-data';
import { viewfinderBg } from '@/features/food/theme';
import type { BarcodeScanResult } from '@/features/camera';
import { describeError } from '@/services/api';
import { findScannedFood } from '@/features/food/barcode';
import { Palette, fontFamily, fontSize, radius, spacing, useColors, useStyles } from '@/theme';

type Phase = 'ready' | 'looking' | 'notfound' | 'error';

type BarcodeScannerPanelProps = {
  /** "HH:MM" eaten. */
  time: string;
  onTime: (time: string) => void;
  /** A match: open it in Food Details. `packageGrams` is the serving its package states. */
  onFound: (food: Food, packageGrams: number | null) => void;
  /** Opens the full-screen camera route (src/app/camera/barcode.tsx). */
  onOpenCamera: () => void;
  /** A camera scan the Log couldn't match (or couldn't look up): shown as "not found", or retried. */
  scanResult: BarcodeScanResult | null;
};

/**
 * Scan a product, or type its barcode. The barcode is looked up in the food database
 * (GET /barcodes/{code}); a match goes straight to Food Details (`onFound`), where it's logged
 * as that database food with its units and portions, like any food from search. This sheet
 * only handles the rest: choosing the time, scanning, typing a code, and "not found".
 */
export function BarcodeScannerPanel({ time, onTime, onFound, onOpenCamera, scanResult }: BarcodeScannerPanelProps) {
  const styles = useStyles(makeStyles);
  const colors = useColors();
  const [phase, setPhase] = useState<Phase>(scanResult ? 'looking' : 'ready');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Only the newest lookup's answer counts: a slow one for an earlier code must not win.
  const latest = useRef(0);

  // Asks the API; the answer arrives asynchronously, so this is safe to start from an effect.
  const fetchFood = (raw: string) => {
    const request = ++latest.current;
    findScannedFood(raw).then(
      (hit) => {
        if (request !== latest.current) return;
        if (hit) {
          setPhase('ready');
          onFound(hit.food, hit.grams);
        } else {
          setPhase('notfound');
        }
      },
      (err: unknown) => {
        if (request !== latest.current) return;
        setError(describeError(err));
        setPhase('error');
      },
    );
  };
  const lookup = (raw: string) => {
    setPhase('looking');
    fetchFood(raw);
  };

  // A code from the camera is looked up as soon as the sheet opens with it (the panel starts
  // in 'looking' for it).
  // An effect event, so a new `onFound` from the parent doesn't look the code up again.
  const scanned = scanResult?.data;
  const lookUpScanned = useEffectEvent((code: string) => fetchFood(code));
  useEffect(() => {
    if (scanned) lookUpScanned(scanned);
  }, [scanned]);

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
        <Pressable onPress={onOpenCamera} accessibilityRole="button" accessibilityLabel="Scan another barcode" style={styles.viewfinder}>
          <View style={styles.reticle} />
          {phase === 'looking' ? <ActivityIndicator color="rgba(255,255,255,0.9)" style={styles.looking} accessibilityLabel="Looking up" /> : null}
          <Text style={styles.statusCaption}>
            {phase === 'looking' ? 'Looking up…' : 'Tap to scan again'}
          </Text>
        </Pressable>
      )}

      <WhenPicker value={time} onChange={onTime} label="Eaten at" compact />

      {phase === 'notfound' ? (
        <Text style={styles.fallbackCopy}>That barcode isn&apos;t in the database yet — check the number, or create a custom food.</Text>
      ) : null}
      {phase === 'error' ? <Text style={[styles.fallbackCopy, { color: colors.errorText }]}>Couldn&apos;t look it up: {error}</Text> : null}

      <View style={styles.manualRow}>
        <Field style={styles.manualInput} value={code} onChangeText={setCode} placeholder="Enter barcode number" keyboardType="number-pad" onSubmitEditing={() => lookup(code)} />
        <Button label="Look up" variant="secondary" onPress={() => lookup(code)} />
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
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
  looking: { position: 'absolute' },
});
