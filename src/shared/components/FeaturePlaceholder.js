import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Estado inicial usado enquanto uma feature ainda não possui dados reais. */
export function FeaturePlaceholder({ icon, title, description, actionLabel, onPress }) {
  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <AppText color="primary" variant="overline">
          PONTO CERTO
        </AppText>
        <AppText variant="heading1">{title}</AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons color={colors.primary} name={icon} size={48} />
        </View>
        <AppText style={styles.title} variant="heading2">
          {title}
        </AppText>
        <AppText color="muted" style={styles.description}>
          {description}
        </AppText>
        {actionLabel ? <Button label={actionLabel} onPress={onPress} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.xl },
  header: { gap: spacing.xs },
  content: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
  iconCircle: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 104,
    justifyContent: 'center',
    marginBottom: spacing.lg,
    width: 104,
  },
  title: { textAlign: 'center' },
  description: {
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
    maxWidth: 310,
    textAlign: 'center',
  },
});
