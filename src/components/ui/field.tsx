import { StyleProp, StyleSheet, TextInput, TextInputProps, TextStyle } from 'react-native';

import { colors, fontFamily, fontSize, radius } from '@/theme';

type FieldProps = TextInputProps & { style?: StyleProp<TextStyle> };

/** Bordered text/number input, matching the inputs used throughout LogPageV3.jsx's sheets. */
export function Field({ style, ...rest }: FieldProps) {
  return <TextInput placeholderTextColor={colors.textTertiary} style={[styles.field, style]} {...rest} />;
}

const styles = StyleSheet.create({
  field: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.bgApp,
    paddingVertical: 13,
    paddingHorizontal: 15,
    fontFamily: fontFamily.bold,
    fontSize: fontSize.body,
    color: colors.textPrimary,
  },
});
