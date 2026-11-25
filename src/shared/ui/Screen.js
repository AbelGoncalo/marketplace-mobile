import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

/** Centraliza fundo, área segura e espaçamento das telas. */
export function Screen({
  children,
  scroll = false,
  padded = true,
  safeAreaColor = colors.background,
  style,
  contentStyle,
}) {
  const contentStyles = [styles.content, padded && styles.padded, contentStyle];

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, { backgroundColor: safeAreaColor }, style]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={contentStyles}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.viewport}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={contentStyles}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  viewport: { backgroundColor: colors.background },
  content: { flexGrow: 1 },
  padded: { padding: spacing.md },
});
