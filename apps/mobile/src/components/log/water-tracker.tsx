import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GlassCard } from '@/components/ui/card';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

type WaterTrackerProps = { water: number; onChange: (water: number) => void; total?: number };

export function WaterTracker({ water, onChange, total = 8 }: WaterTrackerProps) {
  return (
    <GlassCard padding={16}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Water</Text>
        <Text style={styles.count}>
          {water} / {total} glasses
        </Text>
      </View>
      <View style={styles.segmentRow}>
        {Array.from({ length: total }).map((_, i) => {
          const filled = i < water;
          return (
            <Pressable
              key={i}
              onPress={() => onChange(i + 1)}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1} glasses`}
              style={[styles.segment, filled ? styles.segmentFilled : styles.segmentEmpty]}
            />
          );
        })}
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
  count: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.small,
    color: colors.textTertiary,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    height: 30,
    borderRadius: 8,
  },
  segmentFilled: {
    backgroundColor: 'rgba(99,102,241,0.85)',
  },
  segmentEmpty: {
    backgroundColor: colors.bgApp,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
});
