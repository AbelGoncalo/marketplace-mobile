import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { colors, radii, spacing } from '@/theme';

const variants = {
  primary: {
    container: { backgroundColor: colors.primary },
    pressed: { backgroundColor: colors.primaryDark },
    textColor: 'inverse',
    spinner: colors.textOnPrimary,
  },
  accent: {
    container: { backgroundColor: colors.accent },
    pressed: { backgroundColor: colors.accentPressed },
    textColor: 'accent',
    spinner: colors.textOnAccent,
  },
  outline: {
    container: { backgroundColor: 'transparent', borderColor: colors.primary, borderWidth: 1 },
    pressed: { backgroundColor: colors.primarySoft },
    textColor: 'primary',
    spinner: colors.primary,
  },
  danger: {
    container: { backgroundColor: colors.danger },
    pressed: { opacity: 0.82 },
    textColor: 'inverse',
    spinner: colors.textOnPrimary,
  },
};

/** Botão acessível com variantes e estado de carregamento. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  fullWidth = false,
  leftIcon,
}) {
  const visual = variants[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        visual.container,
        fullWidth && styles.fullWidth,
        pressed && visual.pressed,
        isDisabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={visual.spinner} size="small" />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <AppText color={visual.textColor} variant="button">
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radii.sm,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.lg,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  disabled: { opacity: 0.48 },
  fullWidth: { alignSelf: 'stretch' },
});
