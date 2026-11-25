import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { OrderAccess } from '@/features/orders/components/OrderAccess';
import { AppText, Button, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Usa a mesma proteção de Cliente e desmonta o fluxo quando a sessão muda. */
export function ReturnAccess({ children }) {
  return (
    <OrderAccess
      title="As minhas devoluções"
      description="Entre para consultar os seus pedidos de devolução."
      returnTo="returns"
    >
      {children}
    </OrderAccess>
  );
}

/** Atualiza ao regressar de um formulário sem duplicar a primeira consulta. */
export function useReturnRefresh(refresh) {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) first.current = false;
      else refresh();
    }, [refresh]),
  );
}

/** Estrutura comum com navegação, rolagem e teclado apropriados ao dispositivo. */
export function ReturnLayout({
  title,
  subtitle,
  children,
  backTo = '/(customer)/returns',
  busy = false,
  onRefresh,
  scrollKey,
  // Permite reutilizar a estrutura em consultas de reembolso com texto acessível próprio.
  refreshLabel = 'Atualizar devoluções',
}) {
  const router = useRouter();
  return (
    <Screen padded={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          disabled={busy}
          onPress={() => router.replace(backTo)}
          style={styles.icon}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <AppText variant="heading2">{title}</AppText>
          {subtitle ? (
            <AppText color="muted" variant="caption">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {onRefresh ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={refreshLabel}
            onPress={onRefresh}
            disabled={busy}
            style={styles.icon}
          >
            <Ionicons name="refresh-outline" size={21} color={colors.primary} />
          </Pressable>
        ) : null}
      </View>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          key={scrollKey}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

/** Cartão simples com cabeçalho que preserva a hierarquia visual do detalhe da compra. */
export function ReturnPanel({ title, children }) {
  return (
    <View style={styles.panel}>
      {title ? <AppText variant="heading3">{title}</AppText> : null}
      {children}
    </View>
  );
}

/** Distingue consulta, falha recuperável e lista vazia com textos específicos de devoluções. */
export function ReturnFeedback({
  isLoading,
  error,
  empty,
  emptyText = 'Ainda não tem pedidos de devolução.',
  // Mantém a mensagem adequada à área que reutiliza o indicador de consulta.
  loadingText = 'A consultar devoluções...',
  onRetry,
}) {
  if (isLoading)
    return (
      <View style={styles.feedback}>
        <ActivityIndicator color={colors.primary} />
        <AppText color="muted">{loadingText}</AppText>
      </View>
    );
  if (error)
    return (
      <ReturnPanel>
        <AppText color="danger">{error}</AppText>
        <Button label="Tentar novamente" variant="outline" onPress={onRetry} />
      </ReturnPanel>
    );
  if (empty)
    return (
      <View style={styles.feedback}>
        <Ionicons name="return-down-back-outline" size={36} color={colors.primary} />
        <AppText color="muted">{emptyText}</AppText>
      </View>
    );
  return null;
}

/** Navega entre páginas da API sem dar a entender que só existem quinze produtos. */
export function ReturnPagination({ page, data, onPage }) {
  const last = Number(data?.last_page) || 1;
  if (last <= 1) return null;
  return (
    <View style={styles.pagination}>
      <AppText variant="caption" color="muted">
        Página {page} de {last}
      </AppText>
      <View style={styles.buttons}>
        <Button
          label="Anterior"
          variant="outline"
          disabled={page <= 1}
          onPress={() => onPage(page - 1)}
        />
        <Button
          label="Seguinte"
          variant="outline"
          disabled={page >= last}
          onPress={() => onPage(page + 1)}
        />
      </View>
    </View>
  );
}

// Superfícies leves e espaçamento consistente mantêm os formulários legíveis em ecrãs pequenos.
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  feedback: { padding: spacing.lg, alignItems: 'center', gap: spacing.md },
  pagination: { gap: spacing.md, paddingVertical: spacing.md },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
