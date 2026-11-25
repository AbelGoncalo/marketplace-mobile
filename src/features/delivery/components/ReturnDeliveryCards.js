import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { DeliverySection } from '@/features/delivery/components/DeliveryCards';
import {
  returnDeliveryStates,
  returnDeliveryStatus,
} from '@/features/delivery/services/deliveryReturnsApi';
import { orderDate } from '@/features/orders/utils/orderPresentation';
import { ReturnDetailHistory } from '@/features/returns/components/ReturnDetailCards';
import { ReturnProduct } from '@/features/returns/components/ReturnProduct';
import { AppText, Badge } from '@/shared/ui';
import { colors, radii, shadows, spacing } from '@/theme';

/** Cor operacional do estado, sem atribuir a uma recolha o significado de entrega normal. */
function statusVariant(status) {
  if (status === 'DELIVERED') return 'success';
  if (['PICKUP_FAILED', 'DELIVERY_FAILED', 'CANCELLED'].includes(status)) return 'promotion';
  if (['PICKED_UP', 'IN_TRANSIT'].includes(status)) return 'info';
  return 'warning';
}
/** Mostra o estado logístico oficial da recolha reversa. */
export function ReturnDeliveryStatus({ status }) {
  return <Badge label={returnDeliveryStatus(status)} variant={statusVariant(status)} />;
}
/** Filtros compactos por estado; a filtragem continua a ser feita no servidor. */
export function ReturnDeliveryFilters({ value, onChange }) {
  return (
    <View style={styles.filterSection}>
      <AppText variant="overline" color="muted">
        ESTADO DA RECOLHA
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {returnDeliveryStates.map((entry) => (
          <Pressable
            key={entry.value || 'all'}
            accessibilityRole="button"
            accessibilityLabel={entry.label}
            accessibilityState={{ selected: entry.value === value }}
            onPress={() => onChange(entry.value)}
            style={({ pressed }) => [
              styles.filter,
              entry.value === value && styles.filterActive,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="caption" color={entry.value === value ? 'inverse' : 'muted'}>
              {entry.label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
/** Compõe morada completa a partir do snapshot devolvido pela API. */
function addressLine(snapshot) {
  return [snapshot?.address, snapshot?.municipality?.name, snapshot?.province?.name]
    .filter(Boolean)
    .join(' · ');
}
/** Resume referência, estado, cliente e agendamento numa unidade tocável. */
export function ReturnDeliveryListCard({ delivery, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver recolha ${delivery.reference}`}
      onPress={onPress}
      style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
    >
      <View style={styles.listHeader}>
        <View style={styles.referenceBlock}>
          <AppText variant="overline" color="muted">
            DEVOLUÇÃO
          </AppText>
          <AppText variant="bodyStrong">{delivery.customer?.name || 'Cliente'}</AppText>
          <AppText variant="caption" color="muted">
            {delivery.return_request?.reference || delivery.reference}
          </AppText>
        </View>
        <ReturnDeliveryStatus status={delivery.status} />
      </View>
      <View style={styles.routeCompact}>
        <View style={styles.routeRailCompact}>
          <View style={styles.routeDot} />
          <View style={styles.routeLineCompact} />
          <Ionicons name="storefront-outline" size={17} color={colors.primary} />
        </View>
        <View style={styles.routeTextCompact}>
          <View>
            <AppText variant="caption" color="muted">
              RECOLHA
            </AppText>
            <AppText variant="bodyStrong">{delivery.customer?.name || 'Cliente'}</AppText>
            <AppText variant="caption" color="muted">
              {addressLine(delivery.origin) || 'Morada por confirmar'}
            </AppText>
          </View>
          <View>
            <AppText variant="caption" color="muted">
              DESTINO
            </AppText>
            <AppText variant="bodyStrong">{delivery.destination?.store?.name || 'Loja'}</AppText>
          </View>
        </View>
      </View>
      {delivery.scheduled_at ? (
        <AppText variant="caption" color="muted">
          Agendada para {orderDate(delivery.scheduled_at)}
        </AppText>
      ) : null}
    </Pressable>
  );
}
/** Apresenta referências e datas oficiais sem recalcular prazos. */
export function ReturnDeliverySummary({ delivery }) {
  return (
    <DeliverySection title="Resumo da recolha" icon="receipt-outline">
      <View style={styles.summary}>
        <AppText variant="heading2">
          {delivery.return_request?.reference || delivery.reference}
        </AppText>
        <ReturnDeliveryStatus status={delivery.status} />
        <View style={styles.summaryRow}>
          <AppText variant="caption" color="muted">
            Encomenda
          </AppText>
          <AppText variant="bodyStrong">{delivery.order?.reference || 'Sem referência'}</AppText>
        </View>
        {delivery.scheduled_at ? (
          <View style={styles.summaryRow}>
            <AppText variant="caption" color="muted">
              Agendamento
            </AppText>
            <AppText variant="bodyStrong">{orderDate(delivery.scheduled_at)}</AppText>
          </View>
        ) : null}
        {delivery.picked_up_at ? (
          <View style={styles.summaryRow}>
            <AppText variant="caption" color="muted">
              Recolhida em
            </AppText>
            <AppText variant="bodyStrong">{orderDate(delivery.picked_up_at)}</AppText>
          </View>
        ) : null}
        {delivery.in_transit_at ? (
          <View style={styles.summaryRow}>
            <AppText variant="caption" color="muted">
              Em transporte desde
            </AppText>
            <AppText variant="bodyStrong">{orderDate(delivery.in_transit_at)}</AppText>
          </View>
        ) : null}
      </View>
    </DeliverySection>
  );
}
/** Representa o percurso Cliente → Loja e mantém contactos selecionáveis. */
export function ReturnDeliveryRoute({ delivery }) {
  return (
    <DeliverySection title="Rota da recolha" icon="map-outline">
      <View style={styles.route}>
        <View style={styles.routeRail}>
          <View style={styles.routeIcon}>
            <Ionicons name="person-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.routeLine} />
          <View style={[styles.routeIcon, styles.destinationIcon]}>
            <Ionicons name="storefront-outline" size={18} color={colors.textOnPrimary} />
          </View>
        </View>
        <View style={styles.routeContent}>
          <View style={styles.routeStop}>
            <AppText variant="caption" color="muted">
              RECOLHA · CLIENTE
            </AppText>
            <AppText variant="bodyStrong">{delivery.customer?.name || 'Cliente'}</AppText>
            <AppText selectable>{addressLine(delivery.origin) || 'Morada por confirmar'}</AppText>
            {delivery.customer?.phone || delivery.origin?.phone ? (
              <AppText selectable variant="caption" color="primary">
                {delivery.customer?.phone || delivery.origin?.phone}
              </AppText>
            ) : null}
          </View>
          <View style={styles.routeStop}>
            <AppText variant="caption" color="muted">
              DESTINO · LOJA
            </AppText>
            <AppText variant="bodyStrong">{delivery.destination?.store?.name || 'Loja'}</AppText>
            <AppText selectable>
              {addressLine(delivery.destination?.address) || 'Morada por confirmar'}
            </AppText>
          </View>
        </View>
      </View>
    </DeliverySection>
  );
}
/** Mostra o produto histórico e a quantidade solicitada, sem recalcular valores. */
export function ReturnDeliveryProduct({ delivery }) {
  return (
    <DeliverySection title="Produto devolvido" icon="cube-outline">
      <ReturnProduct
        product={delivery.item?.product_snapshot}
        store={delivery.destination?.store?.name}
      >
        <AppText variant="caption" color="primary">
          Quantidade solicitada: {delivery.return_request?.quantity || 0}
        </AppText>
        {delivery.return_request?.reason ? (
          <AppText variant="caption" color="muted">
            Motivo: {returnDeliveryReason(delivery.return_request.reason)}
          </AppText>
        ) : null}
      </ReturnProduct>
    </DeliverySection>
  );
}
/** Converte a timeline oficial numa linha temporal compacta e cronológica. */
export function ReturnDeliveryTimeline({ delivery }) {
  if (!delivery.timeline?.length) return null;
  return (
    <DeliverySection title="Histórico da recolha" icon="time-outline" quiet>
      <ReturnDetailHistory events={delivery.timeline} label={returnDeliveryStatus} />
    </DeliverySection>
  );
}
/** Traduz o motivo devolvido pela API sem inventar categorias novas. */
function returnDeliveryReason(reason) {
  const labels = {
    DEFECTIVE: 'Produto defeituoso',
    WRONG_ITEM: 'Produto trocado',
    NOT_AS_DESCRIBED: 'Diferente do anunciado',
    DAMAGED: 'Produto danificado',
    CHANGED_MIND: 'Desistência da compra',
    OTHER: 'Outro motivo',
  };
  return labels[reason] || reason;
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.76 },
  filterSection: { gap: spacing.sm },
  filters: { gap: spacing.sm, paddingRight: spacing.md },
  filter: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  listCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card,
  },
  listHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  referenceBlock: { flex: 1, minWidth: 0, gap: spacing.xs },
  routeCompact: { flexDirection: 'row', gap: spacing.sm },
  routeRailCompact: { alignItems: 'center', paddingTop: spacing.xs, width: 14 },
  routeDot: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  routeLineCompact: {
    backgroundColor: colors.border,
    flex: 1,
    marginVertical: 4,
    width: 2,
  },
  routeTextCompact: { flex: 1, gap: spacing.sm, minWidth: 0 },
  summary: { gap: spacing.sm },
  summaryRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  route: { flexDirection: 'row', gap: spacing.sm },
  routeRail: { alignItems: 'center', paddingTop: spacing.xs, width: 26 },
  routeIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  destinationIcon: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  routeLine: {
    backgroundColor: colors.border,
    flex: 1,
    marginVertical: 4,
    width: 2,
  },
  routeContent: { flex: 1, gap: spacing.md, minWidth: 0 },
  routeStop: { gap: spacing.xs },
});
