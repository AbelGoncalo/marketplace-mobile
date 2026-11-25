import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProductImage } from '@/features/catalog/components/ProductImage';
import { deliveryStatus } from '@/features/delivery/services/deliveryApi';
import { orderedTimeline } from '@/features/orders/utils/orderPresentation';
import { ReturnDetailHistory } from '@/features/returns/components/ReturnDetailCards';
import { AppText, Badge } from '@/shared/ui';
import { colors, radii, shadows, spacing } from '@/theme';

const progress = ['ASSIGNED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

function statusVariant(status) {
  if (status === 'DELIVERED') return 'success';
  if (['DELIVERY_FAILED', 'RETURNING_TO_STORE', 'RETURNED_TO_STORE', 'CANCELLED'].includes(status))
    return 'promotion';
  if (['PICKED_UP', 'IN_TRANSIT'].includes(status)) return 'info';
  return 'warning';
}

/** Mostra o estado oficial com uma cor operacional, sem alterar o significado da API. */
export function DeliveryStatus({ status }) {
  return <Badge label={deliveryStatus(status)} variant={statusVariant(status)} />;
}

function addressLine(destination) {
  return [destination?.address, destination?.municipality].filter(Boolean).join(' · ');
}

/** Resume origem, destino e estado numa única unidade tocável. */
export function DeliveryListCard({ delivery, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver entrega para ${delivery.client?.name || 'Cliente'}`}
      onPress={onPress}
      style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
    >
      <View style={styles.listHeader}>
        <View style={styles.referenceBlock}>
          <AppText variant="overline" color="muted">
            ENTREGA
          </AppText>
          <AppText variant="bodyStrong">Para {delivery.client?.name || 'Cliente'}</AppText>
        </View>
        <DeliveryStatus status={delivery.operational_status} />
      </View>
      <View style={styles.routeCompact}>
        <View style={styles.routeRailCompact}>
          <View style={styles.routeDot} />
          <View style={styles.routeLineCompact} />
          <Ionicons name="location" size={17} color={colors.primary} />
        </View>
        <View style={styles.routeTextCompact}>
          <View>
            <AppText variant="caption" color="muted">
              RECOLHA
            </AppText>
            <AppText variant="bodyStrong">{delivery.origin?.store?.name || 'Loja'}</AppText>
          </View>
          <View>
            <AppText variant="caption" color="muted">
              ENTREGA
            </AppText>
            <AppText variant="bodyStrong">{delivery.client?.name || 'Cliente'}</AppText>
            {addressLine(delivery.destination) ? (
              <AppText variant="caption" color="muted" numberOfLines={2}>
                {addressLine(delivery.destination)}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
      <View style={styles.listFooter}>
        <View style={styles.listMeta}>
          <Ionicons name="cube-outline" size={16} color={colors.textMuted} />
          <AppText variant="caption" color="muted">
            {delivery.order?.total_quantity || 0} unidade(s)
          </AppText>
        </View>
        <View style={styles.openDetail}>
          <AppText variant="caption" color="primary">
            Ver detalhe
          </AppText>
          <Ionicons name="arrow-forward" size={17} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

/** Identifica a tarefa e representa a progressão normal da operação. */
export function DeliverySummary({ delivery }) {
  const current = progress.indexOf(delivery.operational_status);
  return (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryIdentity}>
          <View style={styles.summaryIcon}>
            <Ionicons name="navigate-outline" size={24} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <AppText variant="overline" color="primary">
              ENTREGA ATRIBUÍDA
            </AppText>
            <AppText variant="heading2">Para {delivery.client?.name || 'Cliente'}</AppText>
            <AppText variant="caption" color="muted">
              {delivery.order?.total_quantity || 0} unidade(s) ·{' '}
              {delivery.origin?.store?.name || 'Loja'}
            </AppText>
          </View>
        </View>
        <DeliveryStatus status={delivery.operational_status} />
      </View>
      {current >= 0 ? (
        <View style={styles.progress} accessibilityLabel="Progresso da entrega">
          {progress.map((step, index) => (
            <View key={step} style={styles.progressItem}>
              <View
                style={[
                  styles.progressDot,
                  index <= current && styles.progressDotActive,
                  index === current && styles.progressDotCurrent,
                ]}
              />
              {index < progress.length - 1 ? (
                <View style={[styles.progressLine, index < current && styles.progressLineActive]} />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
      <AppText variant="caption" color="muted">
        Última atualização operacional: {deliveryStatus(delivery.operational_status)}
      </AppText>
    </View>
  );
}

/** Uniformiza cartões do detalhe e permite destacar a ação operacional. */
export function DeliverySection({ title, icon, children, action = false, quiet = false }) {
  return (
    <View style={[styles.section, action && styles.actionSection, quiet && styles.quietSection]}>
      <View style={[styles.sectionHeader, quiet && styles.quietHeader]}>
        <View style={[styles.sectionIcon, action && styles.actionIcon]}>
          <Ionicons name={icon} size={action ? 24 : 19} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          {action ? (
            <AppText variant="overline" color="primary">
              PRÓXIMO PASSO
            </AppText>
          ) : null}
          <AppText variant={action ? 'heading3' : 'bodyStrong'}>{title}</AppText>
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Adapta formulários existentes ao destaque visual da operação atual. */
export function DeliveryActionPanel({ title, children }) {
  return (
    <DeliverySection
      title={title}
      icon="checkmark-circle-outline"
      action={title === 'Próxima ação'}
    >
      {children}
    </DeliverySection>
  );
}

/** Representa fisicamente o percurso Loja → Cliente e mantém contactos selecionáveis. */
export function DeliveryRoute({ delivery }) {
  return (
    <DeliverySection title="Rota da entrega" icon="map-outline">
      <View style={styles.route}>
        <View style={styles.routeRail}>
          <View style={styles.routeIcon}>
            <Ionicons name="storefront-outline" size={18} color={colors.primary} />
          </View>
          <View style={styles.routeLine} />
          <View style={[styles.routeIcon, styles.destinationIcon]}>
            <Ionicons name="location-outline" size={19} color={colors.textOnPrimary} />
          </View>
        </View>
        <View style={styles.routeContent}>
          <View style={styles.routeStop}>
            <AppText variant="caption" color="muted">
              ORIGEM · LOJA
            </AppText>
            <AppText variant="bodyStrong">{delivery.origin?.store?.name || 'Loja'}</AppText>
            {delivery.origin?.shopping_center?.name ? (
              <AppText color="muted">{delivery.origin.shopping_center.name}</AppText>
            ) : null}
            {delivery.origin?.store?.phone ? (
              <AppText selectable variant="caption" color="primary">
                {delivery.origin.store.phone}
              </AppText>
            ) : null}
          </View>
          <View style={styles.routeStop}>
            <AppText variant="caption" color="muted">
              DESTINO · CLIENTE
            </AppText>
            <AppText variant="bodyStrong">{delivery.client?.name || 'Cliente'}</AppText>
            {delivery.destination?.address ? (
              <AppText selectable>{delivery.destination.address}</AppText>
            ) : (
              <AppText color="muted">Morada indisponível</AppText>
            )}
            {delivery.destination?.municipality ? (
              <AppText variant="caption" color="muted">
                {delivery.destination.municipality}
              </AppText>
            ) : null}
            {delivery.client?.phone ? (
              <AppText selectable variant="caption" color="primary">
                {delivery.client.phone}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>
    </DeliverySection>
  );
}

/** Mostra artigos históricos em linhas compactas, sem recalcular valores. */
export function DeliveryProducts({ delivery }) {
  return (
    <DeliverySection title="Produtos transportados" icon="cube-outline">
      {(delivery.items || []).map((item, index) => (
        <View key={index} style={[styles.product, index > 0 && styles.productDivider]}>
          <View style={styles.imageBase}>
            <ProductImage
              path={item.product?.image}
              label={item.product?.name || 'Produto'}
              style={styles.productImage}
            />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodyStrong">{item.product?.name || 'Produto'}</AppText>
            <View style={styles.quantity}>
              <AppText variant="caption" color="primary">
                {item.quantity} unidade(s)
              </AppText>
            </View>
          </View>
        </View>
      ))}
    </DeliverySection>
  );
}

/** Converte a timeline oficial numa linha temporal compacta e cronológica. */
export function DeliveryHistory({ delivery }) {
  if (!delivery.timeline?.length) return null;
  const events = orderedTimeline(delivery.timeline).map((event) => ({
    ...event,
    notes: event.description,
  }));
  return (
    <DeliverySection title="Histórico da entrega" icon="time-outline" quiet>
      <ReturnDetailHistory events={events} label={deliveryStatus} />
    </DeliverySection>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  pressed: { opacity: 0.76 },
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
  referenceBlock: { flex: 1, minWidth: 130, gap: spacing.xs },
  routeCompact: { flexDirection: 'row', gap: spacing.sm },
  routeRailCompact: { alignItems: 'center', width: 20 },
  routeDot: { backgroundColor: colors.primary, borderRadius: 5, height: 10, width: 10 },
  routeLineCompact: {
    backgroundColor: colors.border,
    flex: 1,
    marginVertical: spacing.xs,
    width: 1,
  },
  routeTextCompact: { flex: 1, gap: spacing.md, minWidth: 0 },
  listFooter: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  listMeta: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  openDetail: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  summary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card,
  },
  summaryTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  summaryIdentity: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 190,
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  progress: { flexDirection: 'row' },
  progressItem: { alignItems: 'center', flex: 1, flexDirection: 'row' },
  progressDot: { backgroundColor: colors.border, borderRadius: 5, height: 10, width: 10 },
  progressDotActive: { backgroundColor: colors.primary },
  progressDotCurrent: { borderColor: colors.surface, borderWidth: 2, height: 14, width: 14 },
  progressLine: { backgroundColor: colors.border, flex: 1, height: 2 },
  progressLineActive: { backgroundColor: colors.primary },
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    ...shadows.card,
  },
  sectionHeader: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  sectionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sectionBody: { gap: spacing.sm, padding: spacing.md },
  actionSection: { borderColor: colors.primary },
  actionIcon: { height: 46, width: 46 },
  quietSection: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    elevation: 0,
    shadowOpacity: 0,
  },
  quietHeader: { borderBottomWidth: 0, paddingBottom: 0 },
  route: { flexDirection: 'row', gap: spacing.md },
  routeRail: { alignItems: 'center', width: 38 },
  routeIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  destinationIcon: { backgroundColor: colors.primary },
  routeLine: { backgroundColor: colors.border, flex: 1, marginVertical: spacing.xs, width: 2 },
  routeContent: { flex: 1, gap: spacing.xl, minWidth: 0 },
  routeStop: { gap: spacing.xs, minHeight: 58 },
  product: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  productDivider: { borderTopColor: colors.border, borderTopWidth: 1, paddingTop: spacing.md },
  imageBase: { backgroundColor: colors.background, borderRadius: radii.sm, padding: spacing.xs },
  productImage: { borderRadius: radii.xs, height: 56, width: 52 },
  quantity: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
