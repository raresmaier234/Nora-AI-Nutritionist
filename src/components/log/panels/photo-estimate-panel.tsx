import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { CameraIcon, CheckIcon, SpinnerIcon } from '@/components/log/icons';
import { FoodIcon } from '@/components/log/food-icon';
import { MealPicker } from '@/components/log/meal-picker';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { SheetTitle } from '@/components/ui/typography';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogSpace } from '@/constants/log-theme';
import { FOOD_DB, MealName, entryMacros, sumMacros } from '@/data/log-mock-data';
import { DetectedItem } from '@/hooks/use-food-log';

type Phase = 'capture' | 'analyzing' | 'result';

type PhotoEstimatePanelProps = {
  meal: MealName;
  onMeal: (meal: MealName) => void;
  onAdd: (items: DetectedItem[]) => void;
};

const MOCK_RESULT = () => [
  { id: 'chicken', name: 'Chicken Breast', per100: FOOD_DB.find((f) => f.id === 'chicken')!.per100, amount: 140, unit: 'g', confidence: 0.92, on: true },
  { id: 'rice', name: 'Rice', per100: FOOD_DB.find((f) => f.id === 'rice')!.per100, amount: 160, unit: 'g', confidence: 0.87, on: true },
  { id: 'broccoli', name: 'Vegetables', per100: FOOD_DB.find((f) => f.id === 'broccoli')!.per100, amount: 90, unit: 'g', confidence: 0.64, on: true },
];

export function PhotoEstimatePanel({ meal, onMeal, onAdd }: PhotoEstimatePanelProps) {
  const [phase, setPhase] = useState<Phase>('capture');
  const [items, setItems] = useState<DetectedItem[]>([]);
  const spin = useSharedValue(0);

  const analyze = () => {
    setPhase('analyzing');
    spin.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1);
    setTimeout(() => {
      setItems(MOCK_RESULT());
      setPhase('result');
    }, 1700);
  };

  const toggle = (id: string) => setItems((list) => list.map((i) => (i.id === id ? { ...i, on: !i.on } : i)));
  const setAmount = (id: string, amount: number) => setItems((list) => list.map((i) => (i.id === id ? { ...i, amount } : i)));
  const chosen = items.filter((i) => i.on);
  const totals = sumMacros(chosen);

  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));

  return (
    <View>
      <SheetTitle>Photo estimate</SheetTitle>
      <Text style={styles.subtitle}>
        {phase === 'result' ? "Nora's estimate — check the amounts before saving" : "Snap your plate and Nora estimates what's on it"}
      </Text>

      <View style={styles.viewfinder}>
        {phase === 'capture' && (
          <View style={styles.centerCol}>
            <CameraIcon size={34} color="rgba(255,255,255,0.85)" strokeWidth={1.7} />
            <Text style={styles.hintText}>Center the whole plate in frame</Text>
          </View>
        )}
        {phase === 'analyzing' && (
          <View style={styles.centerCol}>
            <Animated.View style={spinStyle}>
              <SpinnerIcon size={28} color={LogColor.indigo400} strokeWidth={2.6} />
            </Animated.View>
            <Text style={styles.hintText}>Analyzing your plate…</Text>
          </View>
        )}
        {phase === 'result' && (
          <View style={styles.resultIcons}>
            {chosen.slice(0, 3).map((i) => (
              <FoodIcon key={i.id} name={i.name} size={52} />
            ))}
          </View>
        )}
      </View>

      {phase === 'capture' && (
        <View style={styles.captureActions}>
          <Button label="Take photo" onPress={analyze} flex />
          <Button label="Upload" variant="secondary" onPress={analyze} />
        </View>
      )}

      {phase === 'result' && (
        <>
          <View style={styles.itemList}>
            {items.map((i, idx) => {
              const m = entryMacros(i);
              const low = i.confidence < 0.7;
              return (
                <View
                  key={i.id}
                  style={[styles.itemRow, idx < items.length - 1 && styles.itemRowDivider, !i.on && styles.itemRowExcluded]}>
                  <Pressable
                    onPress={() => toggle(i.id)}
                    accessibilityRole="button"
                    accessibilityLabel={i.on ? 'Exclude' : 'Include'}
                    style={[styles.toggle, i.on ? styles.toggleOn : styles.toggleOff]}>
                    {i.on && <CheckIcon size={12} color={LogColor.white} strokeWidth={3} />}
                  </Pressable>
                  <FoodIcon name={i.name} size={38} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {i.name}
                    </Text>
                    <Text style={[styles.itemConfidence, low && styles.itemConfidenceLow]}>
                      {low ? 'Low confidence — check this' : `${Math.round(i.confidence * 100)}% confident`} · {m.kcal} kcal
                    </Text>
                  </View>
                  <Field
                    style={styles.amountInput}
                    keyboardType="numeric"
                    value={String(i.amount)}
                    onChangeText={(v) => setAmount(i.id, Number(v) || 0)}
                  />
                  <Text style={styles.unitLabel}>{i.unit}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.totalsStrip}>
            <Text style={styles.totalsKcal}>{totals.kcal} kcal</Text>
            <Text style={styles.totalsMeta}>
              {chosen.length} items · P{totals.protein} C{totals.carbs} F{totals.fat}
            </Text>
          </View>

          <MealPicker value={meal} onChange={onMeal} />

          <View style={styles.resultActions}>
            <Button label={`Confirm & add to ${meal}`} disabled={!chosen.length} onPress={() => onAdd(chosen)} flex />
            <Button
              label="Retake"
              variant="secondary"
              onPress={() => {
                setItems([]);
                setPhase('capture');
              }}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.small,
    color: LogColor.textTertiary,
    lineHeight: LogFontSize.small * 1.4,
    marginBottom: LogSpace.lg,
  },
  viewfinder: {
    height: 170,
    borderRadius: LogRadius.lg,
    backgroundColor: LogColor.viewfinderBg,
    overflow: 'hidden',
    marginBottom: LogSpace.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCol: { alignItems: 'center', gap: LogSpace.md },
  hintText: {
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.micro,
    color: 'rgba(255,255,255,0.85)',
  },
  resultIcons: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  captureActions: { flexDirection: 'row', gap: 10 },
  itemList: {
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    borderRadius: LogRadius.lg,
    marginBottom: LogSpace.lg,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 13,
  },
  itemRowDivider: { borderBottomWidth: 1, borderBottomColor: LogColor.borderSubtle },
  itemRowExcluded: { opacity: 0.5 },
  toggle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toggleOn: { backgroundColor: LogColor.green500 },
  toggleOff: { borderWidth: 2, borderColor: LogColor.borderStrong },
  itemText: { flex: 1, minWidth: 0 },
  itemName: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.small,
    color: LogColor.textPrimary,
  },
  itemConfidence: {
    fontFamily: LogFontFamily.semibold,
    fontSize: 10,
    color: LogColor.textTertiary,
    marginTop: 4,
  },
  itemConfidenceLow: { color: LogColor.amberText },
  amountInput: {
    width: 62,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: 10,
    flexShrink: 0,
  },
  unitLabel: {
    fontFamily: LogFontFamily.semibold,
    fontSize: 10,
    color: LogColor.textTertiary,
    flexShrink: 0,
  },
  totalsStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: LogSpace.md + 2,
    backgroundColor: LogColor.successTint,
    borderRadius: LogRadius.md,
    marginBottom: LogSpace.lg - 2,
  },
  totalsKcal: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
  },
  totalsMeta: {
    fontFamily: LogFontFamily.semibold,
    fontSize: LogFontSize.micro,
    color: LogColor.textSecondary,
  },
  resultActions: { flexDirection: 'row', gap: 10 },
});
