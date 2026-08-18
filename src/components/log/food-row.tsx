import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodIcon } from '@/components/log/food-icon';
import { colors, fontFamily, fontSize, spacing } from '@/theme';

type FoodRowProps = {
  name: string;
  meta?: string;
  trailing?: string;
  trailingVariant?: 'bold' | 'meta';
  iconSize?: number;
  onPress?: () => void;
  divider?: boolean;
};

/** `[FoodIcon] [name / meta] [trailing]` row — meal entries, search results, recently added. */
export function FoodRow({ name, meta, trailing, trailingVariant = 'bold', iconSize = 46, onPress, divider = true }: FoodRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && onPress && styles.pressed]}>
      <FoodIcon name={name} size={iconSize} />
      <View style={styles.textCol}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text style={trailingVariant === 'bold' ? styles.trailingBold : styles.trailingMeta}>{trailing}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  pressed: {
    backgroundColor: colors.overlayPress,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
  meta: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    marginTop: 3,
  },
  trailingBold: {
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    flexShrink: 0,
  },
  trailingMeta: {
    fontFamily: fontFamily.medium,
    fontSize: fontSize.micro,
    color: colors.textTertiary,
    flexShrink: 0,
  },
});
