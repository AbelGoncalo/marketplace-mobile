import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { orderDate, orderedTimeline } from '@/features/orders/utils/orderPresentation';
import { ReturnProduct } from '@/features/returns/components/ReturnProduct';
import { returnStatus } from '@/features/returns/services/returnPresentation';
import { returnReasons } from '@/features/returns/services/returnsApi';
import { AppText, Badge } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Dá aos cartões do detalhe um cabeçalho discreto sem alterar listas e formulários existentes. */
export function ReturnDetailPanel({ title, icon, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <AppText variant="heading3" style={styles.flex}>
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

/** Separa a identificação do pedido das datas, com quebra de linha para referências extensas. */
export function ReturnSummary({ request }) {
  return (
    <View style={styles.card}>
      <View style={styles.summaryHeader}>
        <AppText variant="overline" color="muted">
          DEVOLUÇÃO
        </AppText>
        <Badge {...returnStatus(request.status)} />
      </View>
      <View style={styles.field}>
        <AppText variant="caption" color="muted">
          Referência do pedido
        </AppText>
        <AppText variant="bodyStrong" selectable>
          {request.reference}
        </AppText>
      </View>
      <View style={styles.divider} />
      <View style={styles.date}>
        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
        <AppText variant="caption" color="muted" style={styles.flex}>
          Enviado em {orderDate(request.requested_at)}
        </AppText>
      </View>
    </View>
  );
}

/** Distingue decisão, instruções e prazo sem inventar ações nem calcular a elegibilidade localmente. */
export function ReturnDecision({ decision }) {
  if (!decision?.notes && !decision?.return_instructions && !decision?.return_deadline) return null;
  return (
    <ReturnDetailPanel title="Resposta e instruções" icon="document-text-outline">
      {decision.notes ? (
        <View style={styles.field}>
          <AppText variant="caption" color="muted">
            Resposta do Centro
          </AppText>
          <AppText style={styles.description}>{decision.notes}</AppText>
        </View>
      ) : null}
      {decision.return_instructions ? (
        <View style={styles.instructions}>
          <AppText variant="bodyStrong" color="primary">
            Orientações para a devolução
          </AppText>
          <AppText style={styles.description}>{decision.return_instructions}</AppText>
        </View>
      ) : null}
      {decision.return_deadline ? (
        <View style={styles.deadline}>
          <Ionicons name="time-outline" size={20} color={colors.warning} />
          <View style={styles.flex}>
            <AppText variant="caption" style={styles.deadlineLabel}>
              Prazo indicado pelo Centro
            </AppText>
            <AppText variant="bodyStrong">{orderDate(decision.return_deadline)}</AppText>
          </View>
        </View>
      ) : null}
    </ReturnDetailPanel>
  );
}

/** Mantém produto e quantidade juntos e identifica o motivo e a descrição enviados pelo Cliente. */
export function ReturnProductDetails({ request }) {
  return (
    <ReturnDetailPanel title="Produto e motivo" icon="bag-handle-outline">
      <ReturnProduct
        product={request.order_item?.product_snapshot || request.item?.product_snapshot}
        store={request.store?.name}
      >
        <AppText variant="caption" color="muted">
          Quantidade solicitada: {request.quantity}
        </AppText>
      </ReturnProduct>
      <View style={styles.divider} />
      <View style={styles.field}>
        <AppText variant="caption" color="muted">
          Motivo da devolução
        </AppText>
        <AppText variant="bodyStrong">
          {returnReasons.find((reason) => reason.value === request.reason)?.label ||
            'Motivo em atualização'}
        </AppText>
      </View>
      {request.description ? (
        <View style={styles.descriptionBlock}>
          <AppText variant="caption" color="muted">
            Descrição enviada
          </AppText>
          <AppText style={styles.description}>{request.description}</AppText>
        </View>
      ) : null}
    </ReturnDetailPanel>
  );
}

/** Alinha títulos, notas e datas num eixo contínuo; o último acontecimento recebe destaque. */
export function ReturnDetailHistory({ events, label = (status) => returnStatus(status).label }) {
  const timeline = orderedTimeline(events);
  return (
    <View>
      {timeline.map((event, index) => (
        <View key={`${event.occurred_at}-${index}`} style={styles.event}>
          <View style={styles.rail}>
            <View style={[styles.dot, index === timeline.length - 1 && styles.currentDot]} />
            {index < timeline.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={[styles.eventText, index === timeline.length - 1 && styles.lastEvent]}>
            <AppText variant="bodyStrong">{label(event.to_status)}</AppText>
            {event.notes ? (
              <AppText color="muted" style={styles.description}>
                {event.notes}
              </AppText>
            ) : null}
            <AppText variant="caption" color="muted">
              {orderDate(event.occurred_at)}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

// Cartões de uma coluna e cabeçalhos flexíveis preservam a leitura em ecrãs pequenos e com texto ampliado.
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  summaryHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  field: { gap: spacing.xs },
  divider: { height: 1, backgroundColor: colors.border },
  date: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  description: { fontSize: 14, lineHeight: 21 },
  descriptionBlock: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  instructions: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.sm,
    gap: spacing.sm,
  },
  deadline: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radii.sm,
  },
  deadlineLabel: { color: colors.warning },
  event: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 8, height: 8, marginTop: 7, borderRadius: 4, backgroundColor: colors.border },
  currentDot: { backgroundColor: colors.primary },
  line: { width: 1, flex: 1, marginTop: spacing.xs, backgroundColor: colors.border },
  eventText: { flex: 1, minWidth: 0, gap: spacing.xs, paddingBottom: spacing.lg },
  lastEvent: { paddingBottom: 0 },
});
