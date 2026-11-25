import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, shadows, spacing } from '@/theme';

/** Superfície que agrupa conteúdo relacionado. */
export function Card({ children, onPress, padding = 'md', style, ...props }) {
  const cardStyle = [styles.card, styles[`padding_${padding}`], style];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [cardStyle, pressed && styles.pressed]}
        {...props}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={cardStyle} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadows.card,
  },
  padding_none: { padding: 0 },
  padding_sm: { padding: spacing.sm },
  padding_md: { padding: spacing.md },
  padding_lg: { padding: spacing.lg },
  pressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
});
