import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/**
 * Botão visual usado para representar uma categoria do catálogo.
 *
 * @param {object} props
 * @param {string} props.icon Emoji ou símbolo apresentado no cartão.
 * @param {string} props.label Nome visível e acessível da categoria.
 * @param {() => void} props.onPress Ação executada ao selecionar a categoria.
 * @returns {import('react').ReactElement}
 */

export function CategoryCard({ icon, label, onPress }) {
  return (
    <Card
      accessibilityLabel={`Ver categoria ${label}`}
      onPress={onPress}
      padding="sm"
      style={styles.card}
    >
      <View style={styles.iconContainer}>
        <Ionicons color={colors.primary} name={icon} size={25} />
      </View>
      <AppText numberOfLines={1} style={styles.label} variant="caption">
        {label}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: radii.lg,
    justifyContent: 'center',
    minHeight: 82,
    width: 78,
  },
  iconContainer: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 42,
    justifyContent: 'center',
    marginBottom: spacing.xs,
    width: 42,
  },
  label: {
    color: colors.primary,
    fontWeight: '600',
  },
});
