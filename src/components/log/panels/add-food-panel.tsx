import { StyleSheet, Text, View } from 'react-native';

import { FoodRow } from '@/components/log/food-row';
import { QuickEntryAction } from '@/components/log/quick-entry-row';
import { SearchField } from '@/components/log/search-field';
import { Pill } from '@/components/ui/pill';
import { SectionLabel, SheetSubtitle, SheetTitle } from '@/components/ui/typography';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogSpace } from '@/constants/log-theme';
import { Food } from '@/data/log-mock-data';

type AddFoodPanelProps = {
  meal: string;
  query: string;
  onQueryChange: (query: string) => void;
  results: Food[];
  onPickFood: (food: Food) => void;
  onOpenFlow: (action: Exclude<QuickEntryAction, 'search'>) => void;
};

const ROUTES: Array<{ action: Exclude<QuickEntryAction, 'search'>; label: string }> = [
  { action: 'photo', label: 'Photo estimate' },
  { action: 'scan', label: 'Scan barcode' },
  { action: 'recipes', label: 'Recipes' },
  { action: 'custom', label: 'Custom food' },
];

export function AddFoodPanel({ meal, query, onQueryChange, results, onPickFood, onOpenFlow }: AddFoodPanelProps) {
  const trimmed = query.trim();
  const list = trimmed ? results : results.slice(0, 5);

  return (
    <View>
      <SheetTitle>Add to {meal}</SheetTitle>
      <SheetSubtitle>Search, scan, or pick a recent food</SheetSubtitle>

      <View style={styles.searchWrap}>
        <SearchField value={query} onChange={onQueryChange} autoFocus />
      </View>

      <View style={styles.routeRow}>
        {ROUTES.map((r) => (
          <Pill key={r.action} label={r.label} onPress={() => onOpenFlow(r.action)} fontSize={9.5} flex />
        ))}
      </View>

      <SectionLabel>{trimmed ? `${list.length} result${list.length === 1 ? '' : 's'}` : 'Recently added'}</SectionLabel>

      {trimmed && list.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No match for &quot;{trimmed}&quot;</Text>
          <Text style={styles.emptyHint}>Scan the barcode or create it as a custom food.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {list.map((f, i) => (
            <FoodRow
              key={f.id}
              name={f.name}
              trailing={`${f.per100.kcal} kcal/100g`}
              trailingVariant="meta"
              iconSize={40}
              onPress={() => onPickFood(f)}
              divider={i < list.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: { marginBottom: LogSpace.lg },
  routeRow: {
    flexDirection: 'row',
    gap: LogSpace.sm,
    marginBottom: LogSpace.xl - 2,
  },
  list: {
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    borderRadius: LogRadius.lg,
    overflow: 'hidden',
  },
  emptyState: {
    paddingVertical: 22,
    paddingHorizontal: LogSpace.sm + 2,
    alignItems: 'center',
  },
  emptyTitle: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
    textAlign: 'center',
  },
  emptyHint: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.small,
    color: LogColor.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
});
