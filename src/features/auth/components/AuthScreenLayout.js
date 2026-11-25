import { StyleSheet, View } from 'react-native';

import { BrandLogo } from '@/shared/components/BrandLogo';
import { AppText, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Estrutura visual comum às telas de autenticação. */
export function AuthScreenLayout({ title, description, children, formCard = false }) {
  return (
    <Screen contentStyle={styles.screen} scroll>
      <View style={styles.brandPanel}>
        <BrandLogo />
        <View style={styles.glow} />
      </View>
      <View style={[styles.heading, formCard && styles.headingCentered]}>
        <AppText style={formCard && styles.headingText} variant="heading1">
          {title}
        </AppText>
        <AppText color="muted" style={formCard && styles.headingText}>
          {description}
        </AppText>
      </View>
      <View style={[styles.form, formCard && styles.formCard]}>{children}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: spacing.lg, paddingBottom: spacing.xl },
  brandPanel: {
    backgroundColor: colors.primaryDark,
    borderRadius: radii.lg,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  glow: {
    backgroundColor: 'rgba(32,199,244,0.10)',
    borderRadius: radii.pill,
    height: 130,
    position: 'absolute',
    right: -50,
    top: -45,
    width: 130,
  },
  heading: { gap: spacing.sm },
  headingCentered: { alignItems: 'center', paddingHorizontal: spacing.md },
  headingText: { textAlign: 'center' },
  form: { gap: spacing.md },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
  },
});
