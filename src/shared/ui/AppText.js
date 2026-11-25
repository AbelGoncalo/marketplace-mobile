import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/theme';

const colorMap = {
  default: colors.text,
  muted: colors.textMuted,
  primary: colors.primary,
  accent: colors.textOnAccent,
  danger: colors.danger,
  inverse: colors.textOnPrimary,
};

/** Texto com variantes tipográficas do design system. */
export function AppText({ children, variant = 'body', color = 'default', style, ...props }) {
  return (
    <Text style={[styles.base, typography[variant], { color: colorMap[color] }, style]} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({ base: { includeFontPadding: false } });
