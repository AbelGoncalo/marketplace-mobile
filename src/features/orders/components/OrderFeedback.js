import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { AppText, Button } from '@/shared/ui';
import { colors, spacing } from '@/theme';

/** Apresenta estados de consulta sem mensagens de catálogo nem cartões excessivos. */
export function OrderFeedback({
  isLoading,
  error,
  empty,
  onRetry,
  emptyTitle = 'Ainda não tem compras',
  emptyText = 'As compras confirmadas aparecerão aqui.',
}) {
  if (isLoading)
    return (
      <View style={styles.feedback}>
        <ActivityIndicator color={colors.primary} />
        <AppText color="muted">A consultar encomendas...</AppText>
      </View>
    );
  if (error)
    return (
      <View style={styles.feedback}>
        <AppText color="danger">{error}</AppText>
        <Button label="Tentar novamente" variant="outline" onPress={onRetry} />
      </View>
    );
  if (empty)
    return (
      <View style={styles.feedback}>
        <Ionicons name="receipt-outline" size={40} color={colors.primary} />
        <AppText variant="heading2">{emptyTitle}</AppText>
        <AppText color="muted">{emptyText}</AppText>
      </View>
    );
  return null;
}

// Mantém os estados vazios centrados sem ocupar a área dos resultados já carregados.
const styles = StyleSheet.create({
  feedback: { alignItems: 'center', padding: spacing.lg, gap: spacing.md },
});
