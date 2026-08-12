import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoodIcon } from '@/components/log/food-icon';
import { LogColor, LogFontFamily, LogFontSize, LogSpace } from '@/constants/log-theme';

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
    gap: LogSpace.md,
    paddingVertical: LogSpace.md,
    paddingHorizontal: LogSpace.lg - 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: LogColor.borderSubtle,
  },
  pressed: {
    backgroundColor: LogColor.overlayPress,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
  },
  meta: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    marginTop: 3,
  },
  trailingBold: {
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
    flexShrink: 0,
  },
  trailingMeta: {
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.micro,
    color: LogColor.textTertiary,
    flexShrink: 0,
  },
});
