import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { CloseIcon, SearchIcon } from '@/components/log/icons';
import { LogColor, LogFontFamily, LogFontSize, LogRadius, LogSpace } from '@/constants/log-theme';

type SearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export function SearchField({ value, onChange, placeholder = 'Search food...', autoFocus }: SearchFieldProps) {
  return (
    <View style={styles.wrap}>
      <SearchIcon size={18} color={LogColor.textTertiary} strokeWidth={2.2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={LogColor.textTertiary}
        autoFocus={autoFocus}
        style={styles.input}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clearButton}>
          <CloseIcon size={11} color={LogColor.textSecondary} strokeWidth={2.6} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: LogSpace.sm + 2,
    backgroundColor: LogColor.bgApp,
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    borderRadius: LogRadius.pill,
    paddingVertical: 13,
    paddingHorizontal: LogSpace.lg,
  },
  input: {
    flex: 1,
    fontFamily: LogFontFamily.medium,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
    padding: 0,
  },
  clearButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: LogColor.trackEmpty,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
