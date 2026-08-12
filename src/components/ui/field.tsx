import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle } from 'react-native';

import { LogColor, LogFontFamily, LogFontSize, LogRadius } from '@/constants/log-theme';

type FieldProps = TextInputProps & { style?: StyleProp<TextStyle> };

/** Bordered text/number input, matching the inputs used throughout LogPageV3.jsx's sheets. */
export function Field({ style, ...rest }: FieldProps) {
  return <TextInput placeholderTextColor={LogColor.textTertiary} style={[styles.field, style]} {...rest} />;
}

const styles = StyleSheet.create({
  field: {
    borderRadius: LogRadius.md,
    borderWidth: 1,
    borderColor: LogColor.borderSubtle,
    backgroundColor: LogColor.bgApp,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontFamily: LogFontFamily.bold,
    fontSize: LogFontSize.body,
    color: LogColor.textPrimary,
  },
});
