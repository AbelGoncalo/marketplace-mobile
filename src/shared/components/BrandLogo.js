import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

export function BrandLogo({ compact = false }) {
  return (
    <View accessibilityLabel="Ponto Certo" accessibilityRole="header" style={styles.container}>
      <View style={[styles.mark, compact && styles.markCompact]}>
        <Ionicons color={colors.primaryDark} name="location" size={compact ? 19 : 24} />
      </View>
      <View>
        <View style={styles.nameRow}>
          <AppText color="inverse" style={styles.name} variant={compact ? 'heading3' : 'heading2'}>
            Ponto
          </AppText>
          <AppText style={styles.highlight} variant={compact ? 'heading3' : 'heading2'}>
            certo
          </AppText>
        </View>
        {!compact ? (
          <AppText color="inverse" style={styles.tagline} variant="caption">
            Encontre. Escolha. Receba.
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    height: 46,
    justifyContent: 'center',
    transform: [{ rotate: '8deg' }],
    width: 46,
  },
  markCompact: { borderRadius: radii.sm, height: 36, width: 36 },
  nameRow: { flexDirection: 'row', gap: spacing.xs },
  name: { fontWeight: '800', letterSpacing: -0.7 },
  highlight: { color: colors.accent, fontWeight: '800', letterSpacing: -0.7 },
  tagline: { opacity: 0.65 },
});
