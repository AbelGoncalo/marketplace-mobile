import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { complaintDecision } from '@/features/complaints/services/complaintDecision';
import { orderDate } from '@/features/orders/utils/orderPresentation';
import { ReturnDetailPanel } from '@/features/returns/components/ReturnDetailCards';
import { AppText } from '@/shared/ui';
import { colors, radii, spacing } from '@/theme';

/** Destaca a decisão final após o resumo, sem a confundir com pagamento ou devolução executada. */
export function ComplaintDecision({ complaint }) {
  const decision = complaintDecision(complaint);
  if (!decision) return null;
  return (
    <ReturnDetailPanel title="Decisão final" icon="document-text-outline">
      <View style={[styles.outcome, decision.rejected && styles.rejected]}>
        <Ionicons
          name={decision.rejected ? 'close-circle-outline' : 'checkmark-circle-outline'}
          size={22}
          color={decision.rejected ? colors.danger : colors.success}
        />
        <View style={styles.content}>
          <AppText variant="bodyStrong">{decision.label}</AppText>
          <AppText selectable style={styles.description}>
            {decision.text}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" color="muted">
        {decision.date
          ? `${decision.dateLabel} ${orderDate(decision.date)}`
          : 'Data da decisão indisponível'}
      </AppText>
      <AppText variant="caption" color="muted">
        A conversa e os anexos continuam disponíveis para consulta.
      </AppText>
    </ReturnDetailPanel>
  );
}

// A descrição cresce com o conteúdo; o fundo distingue o desfecho sem competir com o resumo.
const styles = StyleSheet.create({
  outcome: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radii.sm,
  },
  rejected: { backgroundColor: colors.dangerSoft },
  content: { flex: 1, minWidth: 0, gap: spacing.sm },
  description: { fontSize: 14, lineHeight: 21 },
});
