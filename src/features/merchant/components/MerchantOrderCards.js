import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { orderAmount, orderDate, orderedTimeline } from '@/features/orders/utils/orderPresentation';
import { merchantOrderStatus } from '@/features/merchant/services/merchantOrdersApi';
import { ReturnDetailHistory } from '@/features/returns/components/ReturnDetailCards';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { AppText, Badge } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

const filters = [
  ['', 'Todas'],
  ['AWAITING_PREPARATION', 'Por preparar'],
  ['PREPARING', 'Em preparação'],
  ['READY_FOR_PICKUP', 'Prontas'],
  ['HANDED_TO_CARRIER', 'Com transportadora'],
  ['COLLECTED_BY_CLIENT', 'Levantadas'],
];
/** Apresenta filtros compactos, mantendo todos os estados e a filtragem no servidor. */
export function MerchantOrderFilters({ value, onChange }) {
  return (
    <View style={styles.filterSection}>
      <AppText variant="overline" color="muted">
        ESTADO DAS ENCOMENDAS
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {filters.map(([status, label]) => (
          <Pressable
            key={status}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: status === value }}
            onPress={() => onChange(status)}
            style={({ pressed }) => [
              styles.filter,
              status === value && styles.filterActive,
              pressed && styles.pressed,
            ]}
          >
            <AppText variant="caption" color={status === value ? 'inverse' : 'muted'}>
              {label}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
/** Distingue as fases de preparação sem atribuir à recolha o significado de entrega ao cliente. */
function Status({ order }) {
  const variant =
    order.fulfillment_status === 'AWAITING_PREPARATION'
      ? 'warning'
      : ['READY_FOR_PICKUP', 'COLLECTED_BY_CLIENT'].includes(order.fulfillment_status)
        ? 'success'
        : 'info';
  const label =
    order.fulfillment_status === 'READY_FOR_PICKUP'
      ? order.delivery?.delivery_method === 'PICKUP'
        ? 'Pronta para levantamento'
        : 'Pronta para recolha'
      : merchantOrderStatus(order.fulfillment_status);
  return <Badge label={label} variant={variant} />;
}
/** Identifica a modalidade efetiva sem assumir transporte quando falta informação. */
function modality(order) {
  return order.delivery?.delivery_method === 'PICKUP'
    ? 'Levantamento na loja'
    : order.delivery?.delivery_method === 'DELIVERY'
      ? 'Entrega por transportadora'
      : 'Modalidade por confirmar';
}
/** Usa o nome histórico disponível, com alternativa legível para dados incompletos. */
function clientName(order) {
  return order.client?.person?.name || order.client?.entity?.name || 'Cliente';
}
/** Alinha ícone e texto com quebra de linha para nomes e contactos extensos. */
function DetailLine({ icon, children }) {
  return (
    <View style={styles.line}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <AppText variant="caption" color="muted" style={styles.flex}>
        {children}
      </AppText>
    </View>
  );
}
/** Resume a encomenda na lista; cliente, modalidade e artigos ficam no detalhe. */
export function MerchantOrderCard({ order, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver encomenda ${order.reference || order.id}, ${order.store?.name || 'Loja'}, ${merchantOrderStatus(order.fulfillment_status)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, styles.listCard, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <AppText variant="bodyStrong" style={styles.reference}>
          {order.reference || `Encomenda ${order.id}`}
        </AppText>
        <Status order={order} />
      </View>
      <View style={styles.line}>
        <Ionicons name="storefront-outline" size={16} color={colors.textMuted} />
        <AppText variant="caption" color="muted" style={styles.flex}>
          {order.store?.name || 'Loja'}
        </AppText>
      </View>
      <View style={styles.footer}>
        <AppText variant="caption" color="muted" style={styles.flex}>
          {orderDate(order.ordered_at)}
        </AppText>
        <View style={styles.amount}>
          <AppText variant="bodyStrong">{orderAmount(order.total_amount)}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.primary} />
      </View>
    </Pressable>
  );
}
/** Apresenta a referência numa base azul suave e separa a identificação da loja no rodapé. */
export function MerchantOrderSummary({ order }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryBody}>
        <View style={styles.header}>
          <View style={styles.summaryLabel}>
            <View style={styles.summaryIcon}>
              <Ionicons name="receipt-outline" size={22} color={colors.primary} />
            </View>
            <AppText variant="overline" color="primary">
              ENCOMENDA
            </AppText>
          </View>
          <Status order={order} />
        </View>
        <AppText variant="heading2" style={styles.summaryReference} selectable>
          {order.reference || `Encomenda ${order.id}`}
        </AppText>
        <DetailLine icon="calendar-outline">{orderDate(order.ordered_at)}</DetailLine>
      </View>
      <View style={styles.summaryStore}>
        <Ionicons name="storefront-outline" size={18} color={colors.primary} />
        <AppText variant="bodyStrong" style={styles.flex}>
          {order.store?.name || 'Loja'}
        </AppText>
      </View>
    </View>
  );
}
/** Diferencia cabeçalho e conteúdo; a ação principal recebe ícone e tratamento próprios. */
export function MerchantDetailSection({ title, icon, children, action = false, quiet = false }) {
  return (
    <View
      style={[styles.detailSection, action && styles.actionSection, quiet && styles.quietSection]}
    >
      <View
        style={[
          styles.sectionHeading,
          action && styles.actionHeading,
          quiet && styles.quietHeading,
        ]}
      >
        <View style={[styles.sectionIcon, action && styles.actionIcon]}>
          <Ionicons name={icon} size={action ? 25 : 19} color={colors.primary} />
        </View>
        <View style={styles.headingContent}>
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
/** Destaca a operação atual sem alterar os controlos de confirmação ou envio. */
export function MerchantActionPanel({ title, children }) {
  return (
    <MerchantDetailSection
      title={title}
      icon="checkmark-circle-outline"
      action={title !== 'Acompanhamento'}
    >
      {children}
    </MerchantDetailSection>
  );
}
/** Mostra cliente e modalidade em blocos que passam a uma coluna com pouco espaço ou texto ampliado. */
export function MerchantOrderCustomer({ order }) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 390 || fontScale > 1.2;
  return (
    <MerchantDetailSection title="Cliente e entrega" icon="people-outline">
      <View style={[styles.customerGrid, stacked && styles.customerStack]}>
        <View style={[styles.customerTile, stacked && styles.customerTileStacked]}>
          <View style={styles.tileLabel}>
            <Ionicons name="person-outline" size={17} color={colors.primary} />
            <AppText variant="caption" color="muted">
              Cliente
            </AppText>
          </View>
          <AppText variant="bodyStrong">{clientName(order)}</AppText>
        </View>
        <View style={[styles.customerTile, stacked && styles.customerTileStacked]}>
          <View style={styles.tileLabel}>
            <Ionicons
              name={
                order.delivery?.delivery_method === 'PICKUP' ? 'bag-handle-outline' : 'car-outline'
              }
              size={17}
              color={colors.primary}
            />
            <AppText variant="caption" color="muted">
              Modalidade
            </AppText>
          </View>
          <AppText variant="bodyStrong">{modality(order)}</AppText>
        </View>
      </View>
    </MerchantDetailSection>
  );
}
/** Alinha cada produto com a fotografia e agrupa quantidade e subtotal numa linha flexível. */
export function MerchantOrderProducts({ order }) {
  return (
    <MerchantDetailSection title="Produtos" icon="bag-handle-outline">
      {(order.items || []).map((item, index) => {
        const product = item.product_snapshot || item.product_variant?.product;
        return (
          <View key={item.id || index} style={[styles.product, index > 0 && styles.productDivider]}>
            <View style={styles.productImageBase}>
              <ProductImage
                path={product?.image}
                label={product?.name || 'Produto'}
                style={styles.productImage}
              />
            </View>
            <View style={styles.productContent}>
              <AppText variant="bodyStrong">{product?.name || 'Produto'}</AppText>
              <AppText variant="caption" color="muted">
                Preço unitário · {orderAmount(item.unit_price)}
              </AppText>
              <View style={styles.productAmounts}>
                <View style={styles.quantity}>
                  <AppText variant="caption" color="primary">
                    Qtd. {item.quantity}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" style={styles.moneyValue}>
                  {orderAmount(item.subtotal)}
                </AppText>
              </View>
            </View>
          </View>
        );
      })}
    </MerchantDetailSection>
  );
}
/** Distribui rótulo e valor em colunas flexíveis, sem recalcular os totais da API. */
function MoneyLine({ label, value, total = false }) {
  return (
    <View style={styles.moneyLine}>
      <AppText
        variant={total ? 'bodyStrong' : 'body'}
        color={total ? 'inverse' : 'muted'}
        style={styles.flex}
      >
        {label}
      </AppText>
      <AppText
        variant={total ? 'heading2' : 'bodyStrong'}
        color={total ? 'inverse' : 'default'}
        style={styles.moneyValue}
      >
        {orderAmount(value)}
      </AppText>
    </View>
  );
}
/** Evidencia o total e mantém o estado comercial distinto da preparação. */
export function MerchantOrderTotals({ order }) {
  return (
    <MerchantDetailSection title="Valores da encomenda" icon="receipt-outline">
      <MoneyLine label="Produtos" value={order.amount} />
      {Number(order.discount) > 0 ? <MoneyLine label="Desconto" value={order.discount} /> : null}
      <MoneyLine label="Entrega" value={order.delivery_fee} />
      <View style={styles.total}>
        <View style={styles.totalLabel}>
          <Ionicons name="wallet-outline" size={19} color={colors.textOnPrimary} />
          <AppText variant="caption" color="inverse">
            VALOR DA ENCOMENDA
          </AppText>
        </View>
        <MoneyLine label="Total" value={order.total_amount} total />
      </View>
      <DetailLine icon="card-outline">
        Estado comercial: {order.order_status?.name || 'Em atualização'}
      </DetailLine>
    </MerchantDetailSection>
  );
}
/** Reutiliza a linha temporal existente, preservando as descrições reais dos acontecimentos. */
export function MerchantOrderHistory({ order }) {
  if (!order.fulfillment_histories?.length) return null;
  const events = orderedTimeline(order.fulfillment_histories).map((event) => ({
    ...event,
    notes: event.description,
  }));
  return (
    <MerchantDetailSection title="Histórico da encomenda" icon="time-outline" quiet>
      <ReturnDetailHistory events={events} label={merchantOrderStatus} />
    </MerchantDetailSection>
  );
}

// Linhas flexíveis e quebra de texto preservam a leitura com referências longas e fonte ampliada.
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  // O cartão da lista tem cantos discretos e espaçamento próprio, sem afetar o resumo do detalhe.
  listCard: { borderRadius: radii.md, gap: spacing.sm + spacing.xs },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reference: { flexGrow: 1, flexShrink: 1, minWidth: 120 },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1, minWidth: 0 },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  amount: { flexShrink: 1 },
  filters: { gap: spacing.sm },
  filterSection: { gap: spacing.sm },
  filter: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pressed: { opacity: 0.75 },
  summaryCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    boxShadow: '0px 3px 12px rgba(7, 11, 37, 0.04)',
  },
  summaryBody: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.sm + spacing.xs,
  },
  summaryLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryReference: { color: colors.primaryDark },
  summaryStore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  detailSection: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: '0px 3px 12px rgba(7, 11, 37, 0.04)',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionBody: { padding: spacing.md, gap: spacing.sm + spacing.xs },
  headingContent: { flex: 1, minWidth: 0, gap: spacing.xxs },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSection: { borderColor: colors.primary },
  actionHeading: { borderBottomColor: colors.primarySoft },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  quietSection: { backgroundColor: 'transparent', borderColor: 'transparent', boxShadow: 'none' },
  quietHeading: { borderBottomWidth: 0, paddingBottom: 0 },
  customerGrid: { flexDirection: 'row', gap: spacing.sm },
  customerStack: { flexDirection: 'column' },
  // Em coluna, a altura acompanha o conteúdo em vez de dividir uma altura indefinida.
  customerTileStacked: { flex: 0 },
  customerTile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.sm + spacing.xs,
    gap: spacing.sm,
  },
  tileLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  productImageBase: {
    padding: spacing.xs,
    backgroundColor: colors.background,
    borderRadius: radii.sm,
  },
  product: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + spacing.xs,
    paddingVertical: spacing.xs,
  },
  productImage: { width: 56, height: 64, borderRadius: radii.xs },
  productContent: { flex: 1, minWidth: 0, gap: spacing.xs },
  productAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  quantity: {
    borderRadius: radii.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primarySoft,
  },
  productDivider: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  moneyLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  moneyValue: { flexShrink: 1, textAlign: 'right' },
  // O valor final ganha uma faixa própria; continua a usar o total oficial da API.
  total: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  totalLabel: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
});
