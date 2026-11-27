import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { returnReasons } from '@/features/returns/services/returnsApi';
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
/** Compõe a morada histórica sem truncar os dados necessários à deslocação. */
function addressLine(snapshot) {
  return [
    snapshot?.address,
    typeof snapshot?.municipality === 'string'
      ? snapshot.municipality
      : snapshot?.municipality?.name,
    typeof snapshot?.province === 'string' ? snapshot.province : snapshot?.province?.name,
  ]
    .filter(Boolean)
    .join(' · ');
}
/** Mostra apenas a identificação, o percurso resumido e o agendamento na lista. */
export function ReturnDeliveryListCard({ delivery, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver recolha ${delivery.reference}, ${delivery.customer?.name || 'Cliente'}, ${returnDeliveryStatus(delivery.status)}`}
      onPress={onPress}
      style={({ pressed }) => [styles.listCard, pressed && styles.pressed]}
    >
      <View style={styles.listHeader}>
        <AppText variant="bodyStrong" style={styles.referenceBlock}>
          {delivery.return_request?.reference || delivery.reference}
        </AppText>
        <ReturnDeliveryStatus status={delivery.status} />
      </View>
      <View style={styles.compactRoute}>
        <View style={styles.compactStop}>
          <Ionicons name="person-outline" size={17} color={colors.primary} />
          <View style={styles.flex}>
            <AppText variant="caption" color="muted">
              Recolher junto de
            </AppText>
            <AppText variant="bodyStrong">{delivery.customer?.name || 'Cliente'}</AppText>
          </View>
        </View>
        <View style={styles.compactStop}>
          <Ionicons name="storefront-outline" size={17} color={colors.primary} />
          <View style={styles.flex}>
            <AppText variant="caption" color="muted">
              Entregar na loja
            </AppText>
            <AppText variant="bodyStrong">{delivery.destination?.store?.name || 'Loja'}</AppText>
          </View>
        </View>
      </View>
      <View style={styles.listFooter}>
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
        <AppText variant="caption" color="muted" style={styles.flex}>
          {delivery.scheduled_at ? orderDate(delivery.scheduled_at) : 'Sem agendamento indicado'}
        </AppText>
        <View style={styles.openIcon}>
          <Ionicons name="arrow-forward" size={18} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

/** Define somente as etapas do percurso normal; falhas não são apresentadas como progresso concluído. */
const returnProgress = [
  ['AWAITING_PICKUP', 'A recolher'],
  ['PICKED_UP', 'Recolhida'],
  ['IN_TRANSIT', 'Em transporte'],
  ['DELIVERED', 'Na loja'],
];
/** Apresenta etapas com legendas e adapta a orientação para ecrãs estreitos ou texto ampliado. */
function ReturnProgress({ status }) {
  const { width, fontScale } = useWindowDimensions();
  const vertical = width < 360 || fontScale > 1.2;
  const current = returnProgress.findIndex(([state]) => state === status);
  if (current < 0) return null;
  return (
    <View
      style={[styles.progress, vertical && styles.progressVertical]}
      accessibilityLabel={`Progresso: ${returnDeliveryStatus(status)}`}
    >
      {returnProgress.map(([state, label], index) => (
        <View key={state} style={[styles.progressStep, vertical && styles.progressStepVertical]}>
          <View style={styles.stepRail}>
            <View style={[styles.stepDot, index <= current && styles.stepDotActive]}>
              {index < current ? (
                <Ionicons name="checkmark" size={14} color={colors.textOnPrimary} />
              ) : (
                <AppText variant="caption" color={index === current ? 'inverse' : 'muted'}>
                  {index + 1}
                </AppText>
              )}
            </View>
            {!vertical && index < returnProgress.length - 1 ? (
              <View style={[styles.stepLine, index < current && styles.stepLineActive]} />
            ) : null}
          </View>
          <AppText
            variant="caption"
            color={index === current ? 'primary' : 'muted'}
            style={styles.stepLabel}
          >
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}
/** Identifica a operação num cabeçalho suave; referências e datas ficam separadas do progresso. */
export function ReturnDeliverySummary({ delivery }) {
  return (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryHeading}>
          <View style={styles.summaryIcon}>
            <Ionicons name="return-down-back-outline" size={24} color={colors.primary} />
          </View>
          <AppText variant="overline" color="primary" style={styles.flex}>
            RECOLHA DE DEVOLUÇÃO
          </AppText>
        </View>
        <ReturnDeliveryStatus status={delivery.status} />
        <AppText variant="heading2" selectable>
          {delivery.return_request?.reference || delivery.reference}
        </AppText>
        {delivery.reference && delivery.reference !== delivery.return_request?.reference ? (
          <AppText variant="caption" color="muted" selectable>
            Operação · {delivery.reference}
          </AppText>
        ) : null}
      </View>
      <View style={styles.summaryBody}>
        <ReturnProgress status={delivery.status} />
        {delivery.order?.reference ? (
          <SummaryField label="Encomenda" value={delivery.order.reference} icon="receipt-outline" />
        ) : null}
        {delivery.scheduled_at ? (
          <SummaryField
            label="Agendamento"
            value={orderDate(delivery.scheduled_at)}
            icon="calendar-outline"
          />
        ) : null}
        {delivery.picked_up_at ? (
          <SummaryField
            label="Recolhida em"
            value={orderDate(delivery.picked_up_at)}
            icon="checkmark-circle-outline"
          />
        ) : null}
        {delivery.in_transit_at ? (
          <SummaryField
            label="Em transporte desde"
            value={orderDate(delivery.in_transit_at)}
            icon="navigate-outline"
          />
        ) : null}
      </View>
    </View>
  );
}
/** Mantém rótulo e valor legíveis, permitindo quebra das referências extensas. */
function SummaryField({ label, value, icon }) {
  return (
    <View style={styles.summaryField}>
      <Ionicons name={icon} size={17} color={colors.textMuted} />
      <View style={styles.flex}>
        <AppText variant="caption" color="muted">
          {label}
        </AppText>
        <AppText variant="bodyStrong" selectable>
          {value}
        </AppText>
      </View>
    </View>
  );
}
/** Cartão específico desta área: cabeçalho separado do conteúdo e ação com destaque discreto. */
export function ReturnDeliveryPanel({
  title,
  children,
  icon = 'cube-outline',
  action = false,
  quiet = false,
}) {
  return (
    <View style={[styles.panel, action && styles.actionPanel, quiet && styles.quietPanel]}>
      <View style={styles.panelHeader}>
        <View style={[styles.panelIcon, action && styles.panelActionIcon]}>
          <Ionicons name={icon} size={action ? 23 : 19} color={colors.primary} />
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
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}
/** Adapta as confirmações existentes sem modificar códigos, permissões ou pedidos. */
export function ReturnDeliveryActionPanel({ title, children }) {
  return (
    <ReturnDeliveryPanel title={title} icon="checkmark-circle-outline" action>
      {children}
    </ReturnDeliveryPanel>
  );
}
/** Mostra duas paragens distintas, com moradas completas e contacto identificado. */
export function ReturnDeliveryRoute({ delivery }) {
  return (
    <ReturnDeliveryPanel title="Percurso da devolução" icon="map-outline">
      <RouteStop
        label="01 · RECOLHER NO CLIENTE"
        icon="person-outline"
        name={delivery.customer?.name || 'Cliente'}
        address={addressLine(delivery.origin)}
        phone={delivery.customer?.phone || delivery.origin?.phone}
      />
      <View style={styles.routeConnector}>
        <Ionicons name="arrow-down" size={17} color={colors.textMuted} />
        <AppText variant="caption" color="muted">
          Transportar até à loja
        </AppText>
      </View>
      <RouteStop
        label="02 · ENTREGAR NA LOJA"
        icon="storefront-outline"
        name={delivery.destination?.store?.name || 'Loja'}
        address={addressLine(delivery.destination?.address)}
        destination
      />
      <View style={styles.productBlock}>
        <View style={styles.productHeading}>
          <Ionicons name="bag-handle-outline" size={17} color={colors.primary} />
          <AppText variant="bodyStrong">Artigo a devolver</AppText>
        </View>
        <ReturnDeliveryProduct delivery={delivery} />
      </View>
    </ReturnDeliveryPanel>
  );
}
/** Alinha identidade, morada e contacto sem repetir nomes na mesma paragem. */
function RouteStop({ label, icon, name, address, phone, destination = false }) {
  return (
    <View style={[styles.routeStop, destination && styles.destinationStop]}>
      <View style={styles.stopHeading}>
        <View style={[styles.stopIcon, destination && styles.destinationIcon]}>
          <Ionicons
            name={icon}
            size={19}
            color={destination ? colors.textOnPrimary : colors.primary}
          />
        </View>
        <View style={styles.flex}>
          <AppText variant="overline" color="muted">
            {label}
          </AppText>
          <AppText variant="bodyStrong">{name}</AppText>
        </View>
      </View>
      <AppText selectable>{address || 'Morada por confirmar'}</AppText>
      {phone ? (
        <View style={styles.phone}>
          <Ionicons name="call-outline" size={15} color={colors.primary} />
          <AppText variant="caption" color="primary" selectable style={styles.flex}>
            Contacto · {phone}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
/** Usa o produto histórico; quantidade e motivo recebem tratamentos distintos. */
function ReturnDeliveryProduct({ delivery }) {
  const reason =
    returnReasons.find((entry) => entry.value === delivery.return_request?.reason)?.label ||
    (delivery.return_request?.reason === 'CHANGED_MIND'
      ? 'Mudei de ideias'
      : 'Motivo não indicado');
  return (
    <ReturnProduct product={delivery.item?.product_snapshot}>
      <View style={styles.quantity}>
        <AppText variant="caption" color="primary">
          Qtd. {delivery.return_request?.quantity ?? '—'}
        </AppText>
      </View>
      <AppText variant="caption" color="muted">
        Motivo · {reason}
      </AppText>
    </ReturnProduct>
  );
}
/** Mantém a linha temporal no final, com menos peso visual que a ação principal. */
export function ReturnDeliveryTimeline({ delivery }) {
  if (!delivery.timeline?.length) return null;
  return (
    <ReturnDeliveryPanel title="Histórico da recolha" icon="time-outline" quiet>
      <ReturnDetailHistory events={delivery.timeline} label={returnDeliveryStatus} />
    </ReturnDeliveryPanel>
  );
}

// O desenho é próprio das devoluções; nomes, moradas e etapas podem crescer com o texto do sistema.
const styles = StyleSheet.create({
  pressed: { opacity: 0.76 },
  flex: { flex: 1, minWidth: 0 },
  filterSection: { gap: spacing.sm },
  filters: { gap: spacing.sm, paddingRight: spacing.md },
  filter: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    // Repõe o formato anterior dos separadores, preservando os novos cartões.
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
    gap: spacing.sm + spacing.xs,
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
  referenceBlock: { flexGrow: 1, flexShrink: 1, minWidth: 120 },
  compactRoute: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.sm + spacing.xs,
    gap: spacing.sm + spacing.xs,
  },
  compactStop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  listFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  openIcon: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    ...shadows.card,
  },
  summaryTop: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    gap: spacing.sm,
    borderTopLeftRadius: radii.md,
    borderTopRightRadius: radii.md,
  },
  summaryHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryIcon: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBody: { padding: spacing.md, gap: spacing.md },
  summaryField: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progress: { flexDirection: 'row', gap: spacing.xs },
  progressVertical: { flexDirection: 'column', gap: spacing.sm },
  progressStep: { flex: 1, minWidth: 0, gap: spacing.xs },
  progressStepVertical: { flex: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepRail: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepDotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  stepLine: { flex: 1, height: 2, backgroundColor: colors.border, marginLeft: spacing.xs },
  stepLineActive: { backgroundColor: colors.primary },
  stepLabel: { flexShrink: 1 },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    ...shadows.card,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelIcon: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelActionIcon: { width: 44, height: 44, borderRadius: radii.md },
  panelBody: { padding: spacing.md, gap: spacing.sm + spacing.xs },
  actionPanel: { borderColor: colors.primary },
  quietPanel: { backgroundColor: 'transparent', borderWidth: 0, elevation: 0, shadowOpacity: 0 },
  routeStop: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.sm + spacing.xs,
    gap: spacing.sm,
  },
  destinationStop: { backgroundColor: colors.primarySoft },
  stopHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stopIcon: {
    width: 34,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationIcon: { backgroundColor: colors.primary },
  routeConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingLeft: spacing.sm,
  },
  phone: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  productBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.sm + spacing.xs,
  },
  productHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  quantity: {
    alignSelf: 'flex-start',
    borderRadius: radii.xs,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
