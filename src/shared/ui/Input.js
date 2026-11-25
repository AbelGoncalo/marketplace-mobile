import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { colors, radii, spacing, typography } from '@/theme';

/** Campo de texto com label, ajuda e erro padronizados. */
export function Input({
  label,
  error,
  helperText,
  leftElement,
  rightElement,
  style,
  ...textInputProps
}) {
  const supportingText = error || helperText;

  return (
    <View style={styles.wrapper}>
      {label ? <AppText variant="bodyStrong">{label}</AppText> : null}
      <View style={[styles.field, error && styles.fieldError]}>
        {leftElement}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, style]}
          {...textInputProps}
        />
        {rightElement}
      </View>
      {supportingText ? (
        <AppText color={error ? 'danger' : 'muted'} variant="caption">
          {supportingText}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm },
  field: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  fieldError: { borderColor: colors.danger },
  input: {
    color: colors.text,
    flex: 1,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
});
