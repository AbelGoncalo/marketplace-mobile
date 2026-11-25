import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui/AppText';
import { colors, spacing } from '@/theme';

export function LoadingState({ message = 'A carregar...' }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      <ActivityIndicator color={colors.primary} size="large" />
      <AppText color="muted">{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
