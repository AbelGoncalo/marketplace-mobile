import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useReturnRefresh } from '@/features/returns/components/ReturnLayout';
import { OrderAccess } from '@/features/orders/components/OrderAccess';
import { OrderFeedback } from '@/features/orders/components/OrderFeedback';
import { OrderStatus } from '@/features/orders/components/OrderStatus';
import { getOrders } from '@/features/orders/services/ordersApi';
import { orderAmount, orderDate } from '@/features/orders/utils/orderPresentation';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Mantém a listagem privada desmontada até existir uma conta de Cliente. */
export function OrdersScreen() {
  const params = useLocalSearchParams();
  const complaintEligible = params.purpose === 'complaint';
  return (
    <OrderAccess>
      {(session) => (
        <OrdersList
          key={`${session.token}-${complaintEligible}`}
          token={session.token}
          complaintEligible={complaintEligible}
        />
      )}
    </OrderAccess>
  );
}

/** Lista compras por página sem acumular resultados de contas ou páginas anteriores. */
function OrdersList({ token, complaintEligible }) {
  const router = useRouter();
  const list = useRef(null);
  const [page, setPage] = useState(1);
  const loader = useCallback(
    () => getOrders(token, page, complaintEligible),
    [token, page, complaintEligible],
  );
  const query = useApiQuery(loader);
  // Ao regressar de uma reclamação, atualiza a elegibilidade sem acumular resultados antigos.
  useReturnRefresh(query.refresh);
  const items = query.data?.data || [];
  const lastPage = Number(query.data?.last_page) || 1;

  /** Reposiciona a lista ao mudar de página para não deixar o início escondido. */
  function changePage(next) {
    setPage(next);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }

  return (
    <Screen padded={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={complaintEligible ? 'Voltar às reclamações' : 'Voltar ao perfil'}
          style={styles.icon}
          onPress={() =>
            router.replace(
              complaintEligible ? '/(customer)/complaints' : '/(customer)/(tabs)/profile',
            )
          }
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <AppText variant="heading2" style={styles.title}>
          {complaintEligible ? 'Escolher compra para reclamar' : 'As minhas encomendas'}
        </AppText>
      </View>
      <FlatList
        ref={list}
        data={items}
        keyExtractor={(item) => item.reference}
        contentContainerStyle={styles.content}
        refreshing={query.isLoading}
        onRefresh={query.refresh}
        ListEmptyComponent={
          <OrderFeedback
            {...query}
            empty
            onRetry={query.refresh}
            emptyTitle={complaintEligible ? 'Sem encomendas disponíveis' : undefined}
            emptyText={
              complaintEligible
                ? 'Não existem compras com encomendas ativas disponíveis para reclamar.'
                : undefined
            }
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${complaintEligible ? 'Selecionar' : 'Ver'} compra de ${orderDate(item.created_at)}`}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() =>
              router.push({
                pathname: complaintEligible
                  ? '/(customer)/complaints/new'
                  : '/(customer)/orders/[reference]',
                params: { reference: item.reference },
              })
            }
          >
            <View style={styles.row}>
              <AppText color="muted" variant="caption">
                {orderDate(item.created_at)}
              </AppText>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
            <AppText variant="heading3">{orderAmount(item.total, item.currency)}</AppText>
            <OrderStatus order={item.order_status} payment={item.payment_status} />
            <AppText color="muted" variant="caption">
              {item.total_quantity} unidades · {item.stores_count}{' '}
              {Number(item.stores_count) === 1 ? 'loja' : 'lojas'}
            </AppText>
            <AppText color="muted" variant="caption" numberOfLines={1}>
              Compra {item.reference}
            </AppText>
          </Pressable>
        )}
        ListFooterComponent={
          !query.isLoading && !query.error && lastPage > 1 ? (
            <View style={styles.pagination}>
              <AppText color="muted" variant="caption">
                Página {page} de {lastPage}
              </AppText>
              <View style={styles.row}>
                <Button
                  label="Anterior"
                  variant="outline"
                  disabled={page <= 1}
                  onPress={() => changePage(page - 1)}
                />
                <Button
                  label="Seguinte"
                  disabled={page >= lastPage}
                  onPress={() => changePage(page + 1)}
                />
              </View>
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

// Uma superfície por compra deixa a data, o valor e os estados fáceis de comparar.
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, flexGrow: 1 },
  card: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.primarySoft },
  pagination: { gap: spacing.md, paddingVertical: spacing.md },
});
