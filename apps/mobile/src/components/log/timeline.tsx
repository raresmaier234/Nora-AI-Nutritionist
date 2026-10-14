import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodIcon } from '@/components/log/food-icon';
import { PlusIcon } from '@/components/log/icons';
import { colors, fontFamily, fontSize, radius, shadows, spacing, trackWide } from '@/theme';
import { Entry, entryMacros } from '@/features/food/data/mock-data';
import { fmtDur, fromMin, groupMoments, nowHHMM, toMin } from '@/features/food/time';

const DAY_START = 6;
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

type TimelineProps = {
  /** Sorted by time. */
  entries: Entry[];
  isToday: boolean;
  onOpenEntry: (entry: Entry) => void;
  /** Log food at "HH:MM". */
  onAddAt: (time: string) => void;
};

/**
 * The day as an hour-by-hour timeline: every hour is a row, entries sit in the hour they were
 * eaten, and tapping any hour logs food at that time. Today also shows a "now" line. Ported
 * from LogPageV3.jsx's timeline block.
 */
export function Timeline({ entries, isToday, onOpenEntry, onAddAt }: TimelineProps) {
  const [showNight, setShowNight] = useState(false);
  // Re-render each minute so the now line and "last ate" stay current.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const nowStr = nowHHMM();
  const nowMin = toMin(nowStr);
  const nowH = Math.floor(nowMin / 60);
  const moments = groupMoments(entries);
  const past = isToday ? entries.filter((e) => toMin(e.time) <= nowMin) : entries;
  const lastE = past[past.length - 1];
  const sinceLast = isToday && lastE ? Math.max(0, nowMin - toMin(lastE.time)) : null;
  const hourOf = (e: Entry) => Math.floor(toMin(e.time) / 60);
  const firstH = entries.length ? hourOf(entries[0]) : 24;
  const start = showNight ? 0 : Math.min(DAY_START, firstH, isToday ? nowH : 24);
  const hours = Array.from({ length: 24 - start }, (_, i) => start + i);

  const row = (e: Entry) => {
    const kcal = entryMacros(e).kcal;
    const later = isToday && toMin(e.time) > nowMin;
    return (
      <Pressable
        key={e.uid}
        onPress={() => onOpenEntry(e)}
        accessibilityRole="button"
        accessibilityLabel={`${e.name}, ${e.time}, ${kcal} kcal`}
        style={({ pressed }) => [styles.entry, later && styles.planned, pressed && styles.pressed]}>
        <FoodIcon name={e.name} size={38} />
        <View style={styles.entryText}>
          <Text style={styles.entryName}>{e.name}</Text>
          <Text style={styles.entryMeta}>
            {e.time} · {e.amount} {e.unit}
            {later ? ' · planned' : ''}
          </Text>
        </View>
        <Text style={styles.entryKcal}>
          {kcal}
          <Text style={styles.entryKcalUnit}> kcal</Text>
        </Text>
      </Pressable>
    );
  };

  const nowLine = (
    <Pressable
      key="now"
      onPress={() => onAddAt(nowStr)}
      accessibilityRole="button"
      accessibilityLabel={`Log food now, ${nowStr}`}
      style={styles.nowRow}>
      <View style={styles.nowLine}>
        <View style={styles.nowDot} />
      </View>
      <View style={styles.nowPill}>
        <PlusIcon size={11} color={colors.white} strokeWidth={3.2} />
        <Text style={styles.nowPillText}>Now · {nowStr}</Text>
      </View>
    </Pressable>
  );

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Timeline</Text>
          <Text style={styles.subtitle}>
            {entries.length
              ? `${moments.length} ${moments.length === 1 ? 'time' : 'times'} eaten`
              : 'Tap any hour to log what you ate then'}
          </Text>
        </View>
        {sinceLast != null ? (
          <View style={styles.lastAte}>
            <Text style={styles.lastAteLabel}>Last ate</Text>
            <Text style={styles.lastAteValue}>{fmtDur(sinceLast)} ago</Text>
          </View>
        ) : null}
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        {(
          [
            [false, 'Waking hours', '06:00 – 24:00'],
            [true, 'Full day', '00:00 – 24:00'],
          ] as const
        ).map(([full, label, range]) => {
          const on = showNight === full;
          return (
            <Pressable
              key={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setShowNight(full)}
              style={[styles.tab, on && styles.tabOn]}>
              <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{label}</Text>
              <Text style={styles.tabRange}>{range}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        {hours.map((h, hi) => {
          const items = entries.filter((e) => hourOf(e) === h);
          const isNowHour = isToday && h === nowH;
          const future = isToday && h > nowH;
          const kcal = items.reduce((acc, e) => acc + entryMacros(e).kcal, 0);
          const before = isNowHour ? items.filter((e) => toMin(e.time) <= nowMin) : items;
          const after = isNowHour ? items.filter((e) => toMin(e.time) > nowMin) : [];
          return (
            <View key={h} style={[styles.hour, hi > 0 && styles.hourDivider, isNowHour && styles.nowHour]}>
              <View style={styles.hourCol}>
                <Text style={[styles.hourLabel, future && styles.hourFuture, isNowHour && styles.hourNow]}>{hh(h)}</Text>
                {kcal > 0 ? <Text style={styles.hourKcal}>{kcal} kcal</Text> : null}
              </View>
              <View style={styles.hourBody}>
                {items.length === 0 && !isNowHour ? (
                  <Pressable
                    onPress={() => onAddAt(hh(h))}
                    accessibilityRole="button"
                    accessibilityLabel={`Log food at ${hh(h)}`}
                    style={({ pressed }) => [styles.emptyHour, pressed && styles.pressed]}>
                    <View style={styles.emptyPlus}>
                      <PlusIcon size={12} color={colors.textTertiary} strokeWidth={2.6} />
                    </View>
                  </Pressable>
                ) : (
                  <View style={styles.hourItems}>
                    {before.map(row)}
                    {isNowHour ? nowLine : null}
                    {after.map(row)}
                    {items.length > 0 && !isNowHour ? (
                      <Pressable
                        onPress={() => onAddAt(fromMin(Math.max(...items.map((e) => toMin(e.time)))))}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.addAt, pressed && styles.pressed]}>
                        <PlusIcon size={11} color={colors.brandPrimary} strokeWidth={3} />
                        <Text style={styles.addAtText}>Add at {hh(h)}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const num = { fontVariant: ['tabular-nums' as const] };

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginHorizontal: 2,
    marginBottom: spacing.md,
  },
  headerText: { minWidth: 0, flexShrink: 1 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.h2, color: colors.textPrimary },
  subtitle: { fontFamily: fontFamily.medium, fontSize: fontSize.small, color: colors.textTertiary, marginTop: 5 },
  lastAte: { alignItems: 'flex-end', flexShrink: 0 },
  lastAteLabel: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.nano,
    color: colors.textTertiary,
    letterSpacing: trackWide(fontSize.nano),
    textTransform: 'uppercase',
  },
  lastAteValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.body, color: colors.brandPrimary, marginTop: 5, ...num },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    marginBottom: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.trackEmpty,
  },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.bgSurfaceSolid, boxShadow: shadows.sm },
  tabLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.small, color: colors.textSecondary },
  tabLabelOn: { color: colors.textPrimary },
  tabRange: { fontFamily: fontFamily.medium, fontSize: fontSize.nano, color: colors.textTertiary, ...num },
  card: {
    backgroundColor: colors.bgSurfaceSolid,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    boxShadow: shadows.sm,
    overflow: 'hidden',
  },
  hour: { flexDirection: 'row' },
  hourDivider: { borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  nowHour: { backgroundColor: 'rgba(99,102,241,0.04)' },
  hourCol: { width: 64, flexShrink: 0, paddingTop: 15, paddingBottom: 10, paddingLeft: spacing.lg },
  hourLabel: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.textSecondary, ...num },
  hourFuture: { color: colors.textTertiary },
  hourNow: { color: colors.brandPrimary },
  hourKcal: { fontFamily: fontFamily.bold, fontSize: fontSize.nano, color: colors.greenText, marginTop: 6, ...num },
  hourBody: { flex: 1, minWidth: 0, borderLeftWidth: 1, borderLeftColor: colors.borderSubtle },
  emptyHour: { minHeight: 48, flex: 1, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: spacing.md },
  emptyPlus: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourItems: { paddingVertical: 4 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: 14, minHeight: 58 },
  planned: { opacity: 0.6 },
  pressed: { backgroundColor: colors.overlayPress },
  entryText: { flex: 1, minWidth: 0 },
  entryName: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary },
  entryMeta: { fontFamily: fontFamily.medium, fontSize: fontSize.micro, color: colors.textTertiary, marginTop: 4, ...num },
  entryKcal: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.textPrimary, flexShrink: 0, ...num },
  entryKcalUnit: { fontFamily: fontFamily.semibold, fontSize: fontSize.micro, color: colors.textTertiary },
  nowRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: spacing.md },
  nowLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: colors.brandPrimary },
  nowDot: {
    position: 'absolute',
    left: -6,
    top: -5,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.brandPrimary,
    borderWidth: 2,
    borderColor: colors.bgSurfaceSolid,
  },
  nowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
  },
  nowPillText: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.white, ...num },
  addAt: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  addAtText: { fontFamily: fontFamily.bold, fontSize: fontSize.micro, color: colors.brandPrimary },
});
