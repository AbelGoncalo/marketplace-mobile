import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ProductImage } from '@/features/catalog/components/ProductImage';
import { routeValue } from '@/features/catalog/utils/productPresentation';
import { eligibleComplaintOrders } from '@/features/complaints/services/complaintsApi';
import { OrderAccess } from '@/features/orders/components/OrderAccess';
import { OrderFeedback } from '@/features/orders/components/OrderFeedback';
import { OrderConfirmation } from '@/features/orders/components/OrderConfirmation';
import { OrderReviews } from '@/features/orders/components/OrderReviews';
import { OrderStatus } from '@/features/orders/components/OrderStatus';
import { getOrder, getOrderTracking } from '@/features/orders/services/ordersApi';
import {
  orderAmount,
  orderDate,
  orderedTimeline,
  orderStatus,
} from '@/features/orders/utils/orderPresentation';
import { useApiQuery } from '@/shared/hooks/useApiQuery';
import { AppText, Button, Screen } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Isola o detalhe por conta e referência para ignorar respostas de uma navegação anterior. */
export function OrderDetailScreen() {
  const params = useLocalSearchParams();
  const reference = routeValue(params.reference);
  return (
    <OrderAccess>
      {(session) => (
        <OrderDetail
          key={`${session.token}-${reference}`}
          token={session.token}
          reference={reference}
        />
      )}
    </OrderAccess>
  );
}

/** Dá a cada secção um cabeçalho consistente e separa as ações do conteúdo informativo. */
function OrderPanel({ title, subtitle, icon, action, children }) {
  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.panelIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading3" style={styles.panelTitle}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText color="muted" variant="caption">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {action}
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

/** Mantém descrições à esquerda e valores tabulares à direita, mesmo com textos longos. */
function AmountRow({ label, value, total = false }) {
  return (
    <View style={[styles.amountRow, total && styles.totalRow]}>
      <AppText
        variant={total ? 'bodyStrong' : 'body'}
        color={total ? 'default' : 'muted'}
        style={styles.amountLabel}
      >
        {label}
      </AppText>
      <AppText
        variant={total ? 'heading2' : 'bodyStrong'}
        color={total ? 'primary' : 'default'}
        style={styles.amountValue}
      >
        {value}
      </AppText>
    </View>
  );
}

/** Apresenta os produtos históricos, a morada e os totais com hierarquia visual consistente. */
function OrderDetail({ token, reference }) {
  const router = useRouter();
  const loader = useCallback(() => getOrder(token, reference), [token, reference]);
  const query = useApiQuery(loader);
  const order = query.data;
  return (
    <Screen padded={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar às encomendas"
          style={styles.icon}
          onPress={() => router.replace('/(customer)/orders')}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <AppText variant="heading2">Detalhe da compra</AppText>
          <AppText color="muted" variant="caption">
            Produtos, entrega e pagamento
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Atualizar compra"
          disabled={query.isLoading}
          style={styles.icon}
          onPress={query.refresh}
        >
          {query.isLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={21} color={colors.primary} />
          )}
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <OrderFeedback {...query} onRetry={query.refresh} />
        {order ? (
          <>
            <View style={styles.overview}>
              <View style={styles.overviewTop}>
                <View style={styles.overviewIcon}>
                  <Ionicons name="bag-check-outline" size={25} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText color="muted" variant="overline">
                    A SUA COMPRA
                  </AppText>
                  <AppText variant="heading3">#{order.reference.slice(-8).toUpperCase()}</AppText>
                </View>
              </View>
              <OrderStatus order={order.order_status} payment={order.payment_status} />
              <View style={styles.overviewMeta}>
                <AppText color="muted" variant="caption">
                  Realizada em {orderDate(order.created_at)}
                </AppText>
                <AppText color="muted" variant="caption" selectable>
                  Referência: {order.reference}
                </AppText>
              </View>
            </View>
            {(order.orders || []).map((storeOrder) => (
              <OrderPanel
                key={storeOrder.reference}
                title={storeOrder.store?.name || 'Loja'}
                subtitle={storeOrder.store?.shopping_center?.name}
                icon="storefront-outline"
              >
                {(storeOrder.items || []).map((item) => (
                  <View key={item.id} style={styles.product}>
                    <ProductImage
                      path={item.product?.image}
                      label={item.product?.name || 'Produto'}
                      style={styles.image}
                    />
                    <View style={styles.flex}>
                      <AppText variant="bodyStrong" numberOfLines={2}>
                        {item.product?.name || 'Produto'}
                      </AppText>
                      {item.product?.values?.length ? (
                        <AppText color="muted" variant="caption" numberOfLines={2}>
                          {item.product.values
                            .map((value) => `${value.feature || 'Opção'}: ${value.value}`)
                            .join(' · ')}
                        </AppText>
                      ) : null}
                      <AppText color="muted" variant="caption">
                        {item.quantity} × {orderAmount(item.unit_price, order.currency)}
                      </AppText>
                      <AppText variant="bodyStrong" style={styles.productAmount}>
                        {orderAmount(item.subtotal, order.currency)}
                      </AppText>
                    </View>
                  </View>
                ))}
                <OrderConfirmation token={token} reference={reference} order={storeOrder} />
                <AmountRow
                  label="Entrega"
                  value={orderAmount(storeOrder.delivery_fee, order.currency)}
                />
                <AmountRow
                  label="Total da loja"
                  value={orderAmount(storeOrder.total, order.currency)}
                />
              </OrderPanel>
            ))}
            <OrderTracking token={token} reference={reference} />
            <OrderPanel title="Morada de entrega" icon="location-outline">
              <AppText variant="bodyStrong">
                {order.delivery_address?.address || 'Morada indisponível'}
              </AppText>
              {order.delivery_address?.municipality ? (
                <AppText color="muted">{order.delivery_address.municipality}</AppText>
              ) : null}
              {order.delivery_address?.phone ? (
                <View style={styles.contact}>
                  <Ionicons name="call-outline" size={15} color={colors.textMuted} />
                  <AppText color="muted" variant="caption">
                    {order.delivery_address.phone}
                  </AppText>
                </View>
              ) : null}
            </OrderPanel>
            <OrderPanel
              title="Resumo do pagamento"
              icon="wallet-outline"
              subtitle={orderStatus(order.payment_status, true).label}
            >
              <AmountRow label="Produtos" value={orderAmount(order.subtotal, order.currency)} />
              {Number(order.discount_total) > 0 ? (
                <AmountRow
                  label="Descontos"
                  value={orderAmount(order.discount_total, order.currency)}
                />
              ) : null}
              <AmountRow
                label="Entrega"
                value={orderAmount(order.delivery_total, order.currency)}
              />
              <AmountRow
                label="Total da compra"
                value={orderAmount(order.total, order.currency)}
                total
              />
            </OrderPanel>
            {order.timeline?.length ? (
              <OrderPanel title="Histórico da compra" icon="time-outline">
                <OrderTimeline
                  events={orderedTimeline(order.timeline).map((event) => ({
                    ...event,
                    label: event.description || orderStatus(event.order_status).label,
                    description: null,
                  }))}
                />
              </OrderPanel>
            ) : null}
            <OrderPanel title="Devoluções" icon="return-down-back-outline">
              <AppText color="muted">
                Consulte os seus pedidos ou verifique que produtos podem ser devolvidos.
              </AppText>
              <Button
                label="As minhas devoluções"
                variant="outline"
                onPress={() => router.push('/(customer)/returns')}
                fullWidth
              />
            </OrderPanel>
            {/* A abertura parte desta compra; o formulário reconsulta as encomendas e artigos da conta. */}
            <OrderPanel title="Reclamações" icon="chatbox-ellipses-outline">
              <AppText color="muted">
                Reporte um problema com o produto, a loja, a entrega ou o pagamento.
              </AppText>
              {/* As outras áreas da compra continuam acessíveis mesmo sem elegibilidade para reclamar. */}
              {!eligibleComplaintOrders(order).length ? (
                <AppText variant="caption" color="muted">
                  Sem encomendas ativas disponíveis para uma nova reclamação.
                </AppText>
              ) : null}
              <Button
                disabled={!eligibleComplaintOrders(order).length}
                label="Abrir reclamação"
                variant="outline"
                fullWidth
                onPress={() =>
                  router.push({ pathname: '/(customer)/complaints/new', params: { reference } })
                }
              />
            </OrderPanel>
            {/* A avaliação encerra a página, depois de toda a informação da compra. */}
            <OrderReviews token={token} order={order} />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** Mostra uma linha temporal contínua, mantendo títulos, descrições e datas no mesmo eixo. */
function OrderTimeline({ events }) {
  return (
    <View>
      {events.map((event, index) => (
        <View key={`${event.occurred_at}-${index}`} style={styles.event}>
          <View style={styles.timelineRail}>
            <View style={[styles.dot, index === events.length - 1 && styles.currentDot]} />
            {index < events.length - 1 ? <View style={styles.timelineLine} /> : null}
          </View>
          <View style={styles.eventContent}>
            <AppText variant={index === events.length - 1 ? 'bodyStrong' : 'body'}>
              {event.label}
            </AppText>
            {event.description ? (
              <AppText color="muted" variant="caption">
                {event.description}
              </AppText>
            ) : null}
            <AppText color="muted" variant="caption">
              {orderDate(event.occurred_at)}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Dirige a confirmação do levantamento ao comprador, preservando os códigos e estados da API. */
function TrackingCurrent({ tracking }) {
  const collected = tracking.mode === 'PICKUP' && tracking.current?.code === 'COLLECTED_BY_CLIENT';
  const label = collected ? 'Levantamento concluído' : tracking.current?.label || 'Em atualização';
  const description = collected
    ? 'A loja confirmou que recebeu os seus produtos.'
    : tracking.current?.description;
  return (
    <View style={styles.currentStatus}>
      <View style={styles.statusDot} />
      <View style={styles.flex}>
        <AppText color="primary" variant="bodyStrong">
          {label}
        </AppText>
        {description ? (
          <AppText color="muted" variant="caption">
            {description}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Atualiza a logística separadamente e usa os estados públicos fornecidos pela API. */
function OrderTracking({ token, reference }) {
  const loader = useCallback(() => getOrderTracking(token, reference), [token, reference]);
  const query = useApiQuery(loader);
  const refreshAction = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Atualizar acompanhamento"
      disabled={query.isLoading}
      onPress={query.refresh}
      style={styles.icon}
    >
      {query.isLoading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Ionicons name="refresh-outline" size={20} color={colors.primary} />
      )}
    </Pressable>
  );
  return (
    <OrderPanel title="Acompanhar encomenda" icon="cube-outline" action={refreshAction}>
      <OrderFeedback {...query} onRetry={query.refresh} />
      {(query.data?.orders || []).map((order) => (
        <View key={order.reference} style={styles.tracking}>
          <View style={styles.trackingHeader}>
            <AppText variant="bodyStrong" style={styles.flex}>
              {order.store?.name || 'Loja'}
            </AppText>
            {order.tracking ? (
              <View style={styles.mode}>
                <Ionicons
                  name={order.tracking.mode === 'PICKUP' ? 'storefront-outline' : 'car-outline'}
                  size={14}
                  color={colors.textMuted}
                />
                <AppText color="muted" variant="caption">
                  {order.tracking.mode === 'PICKUP' ? 'Levantamento' : 'Entrega'}
                </AppText>
              </View>
            ) : null}
          </View>
          {order.tracking ? (
            <>
              <TrackingCurrent tracking={order.tracking} />
              {order.tracking.timeline?.length ? (
                <OrderTimeline events={orderedTimeline(order.tracking.timeline)} />
              ) : null}
            </>
          ) : (
            <AppText color="muted" variant="caption">
              O acompanhamento ainda não está disponível.
            </AppText>
          )}
        </View>
      ))}
      {!query.isLoading && !query.error && !query.data?.orders?.length ? (
        <AppText color="muted">Sem entregas para acompanhar.</AppText>
      ) : null}
    </OrderPanel>
  );
}

// Cabeçalhos e colunas flexíveis mantêm o alinhamento sem depender do comprimento dos textos.
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  icon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  overview: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  overviewTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  overviewIcon: {
    width: 48,
    height: 48,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewMeta: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  panelIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelTitle: { fontSize: 16, lineHeight: 22 },
  panelBody: { padding: spacing.md, gap: spacing.md },
  product: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  image: { width: 64, height: 72, borderRadius: radii.sm, overflow: 'hidden' },
  productAmount: { textAlign: 'right', fontVariant: ['tabular-nums'] },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  amountLabel: { flex: 1, minWidth: 0 },
  amountValue: {
    textAlign: 'right',
    maxWidth: '68%',
    flexShrink: 1,
    fontVariant: ['tabular-nums'],
  },
  totalRow: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginHorizontal: -spacing.sm,
  },
  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tracking: {
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
  },
  trackingHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  mode: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  currentStatus: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  event: { flexDirection: 'row', gap: spacing.sm },
  timelineRail: { width: 16, alignItems: 'center', paddingTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  currentDot: { backgroundColor: colors.primary },
  timelineLine: { width: 1, flex: 1, backgroundColor: colors.border, marginTop: 4 },
  eventContent: { flex: 1, minWidth: 0, gap: spacing.xs, paddingBottom: spacing.lg },
});
