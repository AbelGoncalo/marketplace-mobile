import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { orderAmount, orderDate, orderedTimeline } from '@/features/orders/utils/orderPresentation';
import { refundStatus, refundTransactionStatus } from '@/features/refunds/services/refundsApi';
import { ReturnProduct } from '@/features/returns/components/ReturnProduct';
import { AppText, Badge } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Agrupa cada assunto com um título e ícone discretos, mantendo o conteúdo numa única coluna. */
function DetailCard({ title, icon, subtitle, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <View style={styles.flex}>
          <AppText variant="heading3">{title}</AppText>
          {subtitle ? (
            <AppText variant="caption" color="muted">
              {subtitle}
            </AppText>
          ) : null}
        </View>
      </View>
      {children}
    </View>
  );
}

/** Mantém etiquetas e valores próximos; referências longas quebram sem sair do cartão. */
function DetailField({ label, children }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <AppText selectable style={styles.reference}>
        {children}
      </AppText>
    </View>
  );
}

/** Distingue a resposta administrativa do motivo de falha, sem alterar o estado financeiro. */
function ProcessNote({ title, children, danger = false }) {
  return (
    <View style={[styles.note, danger && styles.failureNote]}>
      <AppText variant="caption" style={styles.noteTitle} color={danger ? 'danger' : 'primary'}>
        {title}
      </AppText>
      <AppText style={styles.noteText}>{children}</AppText>
    </View>
  );
}

/** Apresenta uma tentativa com estado separado do valor e datas identificadas pelo resultado. */
function PaymentAttempt({ transaction }) {
  const succeeded = transaction.status === 'SUCCEEDED';
  const failed = transaction.status === 'FAILED';
  const variant = succeeded ? 'success' : failed ? 'warning' : 'info';
  const date = transaction.completed_at || transaction.failed_at || transaction.started_at;
  const dateLabel = transaction.completed_at
    ? 'Concluída em'
    : transaction.failed_at
      ? 'Falhou em'
      : 'Iniciada em';
  return (
    <View style={styles.attempt}>
      <View style={styles.attemptHeader}>
        <AppText variant="bodyStrong">Tentativa {transaction.attempt_number}</AppText>
        <Badge label={refundTransactionStatus(transaction.status)} variant={variant} />
      </View>
      <AppText variant="heading3" style={styles.amount}>
        {orderAmount(transaction.amount, transaction.currency)}
      </AppText>
      <AppText variant="caption" color="muted">
        {dateLabel} {orderDate(date)}
      </AppText>
      {transaction.failure_reason ? (
        <ProcessNote title="Motivo da falha" danger>
          {transaction.failure_reason}
        </ProcessNote>
      ) : null}
    </View>
  );
}

/** Mostra o histórico num eixo contínuo, com a data abaixo de cada acontecimento. */
function RefundTimeline({ events }) {
  const timeline = orderedTimeline(events);
  return timeline.map((event, index) => (
    <View key={`${event.occurred_at}-${index}`} style={styles.timelineRow}>
      <View style={styles.rail}>
        <View style={[styles.dot, index === timeline.length - 1 && styles.currentDot]} />
        {index < timeline.length - 1 ? <View style={styles.line} /> : null}
      </View>
      <View style={[styles.timelineText, index === timeline.length - 1 && styles.lastEvent]}>
        <AppText variant="bodyStrong">{refundStatus(event.to_status).label}</AppText>
        {event.notes ? (
          <AppText color="muted" style={styles.noteText}>
            {event.notes}
          </AppText>
        ) : null}
        <AppText variant="caption" color="muted">
          {orderDate(event.occurred_at)}
        </AppText>
      </View>
    </View>
  ));
}

/** Organiza o detalhe financeiro por prioridade: resumo, orientação, decisão, origem e registos. */
export function RefundDetailContent({ refund, onOpenReturn }) {
  const state = refundStatus(refund.status);
  return (
    <>
      <View style={styles.card}>
        <View style={styles.summaryHeader}>
          <AppText variant="overline" color="muted">
            REEMBOLSO
          </AppText>
          <Badge label={state.label} variant={state.variant} />
        </View>
        <View style={styles.valueBlock}>
          <AppText variant="caption" color="muted">
            Valor do processo
          </AppText>
          <AppText variant="display" color="primary" style={styles.amount}>
            {orderAmount(refund.refund_amount, refund.currency)}
          </AppText>
        </View>
        <View style={styles.divider} />
        <DetailField label="Referência do reembolso">{refund.reference}</DetailField>
        <View style={styles.dates}>
          <DetailField label="Criado em">{orderDate(refund.requested_at)}</DetailField>
          {refund.processed_at ? (
            <DetailField label="Processado em">{orderDate(refund.processed_at)}</DetailField>
          ) : null}
        </View>
      </View>

      <View style={styles.guidance}>
        <Ionicons
          name={
            refund.status === 'REFUNDED' ? 'checkmark-circle-outline' : 'information-circle-outline'
          }
          size={22}
          color={colors.primary}
        />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">
            {refund.status === 'REFUNDED' ? 'Reembolso concluído' : 'Sobre o estado atual'}
          </AppText>
          <AppText color="muted" style={styles.noteText}>
            {state.description}
          </AppText>
        </View>
      </View>

      {refund.decision_notes || refund.failure_reason ? (
        <DetailCard title="Resposta da administração" icon="document-text-outline">
          {refund.decision_notes ? (
            <ProcessNote title="Decisão e observações">{refund.decision_notes}</ProcessNote>
          ) : null}
          {refund.failure_reason ? (
            <ProcessNote title="Motivo da falha" danger>
              {refund.failure_reason}
            </ProcessNote>
          ) : null}
        </DetailCard>
      ) : null}

      <DetailCard title="Origem do reembolso" icon="bag-handle-outline">
        <ReturnProduct product={refund.item?.product_snapshot} store={refund.order?.store?.name}>
          <AppText variant="caption" color="muted">
            Quantidade devolvida: {refund.quantity}
          </AppText>
        </ReturnProduct>
        {refund.order?.reference ? (
          <DetailField label="Encomenda">{refund.order.reference}</DetailField>
        ) : null}
        {refund.return_request?.id ? (
          <>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ver devolução de origem"
              onPress={onOpenReturn}
              style={({ pressed }) => [styles.returnLink, pressed && styles.pressed]}
            >
              <View style={styles.linkIcon}>
                <Ionicons name="return-down-back-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong" color="primary">
                  Ver devolução de origem
                </AppText>
                {refund.return_request.reference ? (
                  <AppText variant="caption" color="muted" style={styles.reference}>
                    {refund.return_request.reference}
                  </AppText>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
            </Pressable>
          </>
        ) : null}
      </DetailCard>

      {refund.transactions?.length ? (
        <DetailCard
          title="Tentativas de pagamento"
          icon="card-outline"
          subtitle="O resultado de cada tentativa financeira."
        >
          {[...refund.transactions]
            .sort((a, b) => a.attempt_number - b.attempt_number)
            .map((transaction) => (
              <PaymentAttempt key={transaction.id} transaction={transaction} />
            ))}
        </DetailCard>
      ) : null}
      {refund.timeline?.length ? (
        <DetailCard title="Histórico do reembolso" icon="time-outline">
          <View>
            <RefundTimeline events={refund.timeline} />
          </View>
        </DetailCard>
      ) : null}
    </>
  );
}

// Quebra de linhas e cabeçalhos flexíveis acomodam referências, estados e fontes maiores no mobile.
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  flex: { flex: 1, minWidth: 0, gap: spacing.xs },
  summaryHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  valueBlock: { gap: spacing.xs, paddingVertical: spacing.sm },
  amount: { fontVariant: ['tabular-nums'] },
  divider: { height: 1, backgroundColor: colors.border },
  field: { gap: spacing.xs, minWidth: 0, flexShrink: 1 },
  reference: { flexShrink: 1 },
  dates: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  guidance: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.primarySoft,
  },
  note: {
    backgroundColor: colors.background,
    borderRadius: radii.sm,
    padding: spacing.md,
    gap: spacing.sm,
  },
  failureNote: { backgroundColor: colors.dangerSoft },
  noteTitle: { fontWeight: '700' },
  noteText: { fontSize: 14, lineHeight: 21 },
  returnLink: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
  },
  linkIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radii.sm,
  },
  pressed: { backgroundColor: colors.background },
  attempt: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  attemptHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  timelineRow: { flexDirection: 'row', gap: spacing.sm },
  rail: { width: 14, alignItems: 'center' },
  dot: { width: 8, height: 8, marginTop: 7, borderRadius: 4, backgroundColor: colors.border },
  currentDot: { backgroundColor: colors.primary },
  line: { width: 1, flex: 1, marginTop: spacing.xs, backgroundColor: colors.border },
  timelineText: { flex: 1, minWidth: 0, gap: spacing.xs, paddingBottom: spacing.lg },
  lastEvent: { paddingBottom: 0 },
});
