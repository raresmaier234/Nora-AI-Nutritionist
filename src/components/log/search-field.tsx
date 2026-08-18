import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CloseIcon, SearchIcon } from '@/components/log/icons';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function SearchField({ value, onChange, placeholder = 'Search food...', autoFocus }: SearchFieldProps) {
  return (
    <View style={styles.wrap}>
      <SearchIcon size={18} color={colors.textTertiary} strokeWidth={2.2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        autoFocus={autoFocus}
        style={styles.input}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clearButton}>
          <CloseIcon size={11} color={colors.textSecondary} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.bgApp,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: radius.pill,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.body,
    color: colors.textPrimary,
    padding: 0,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.trackEmpty,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
