import { apiRequest } from '@/services/http/apiClient';

/** Consulta apenas as combinações de eventos e canais suportadas pela API. */
export function getNotificationPreferences(token) {
  return apiRequest('/notifications/preferences', { token });
}
/** Guarda uma escolha de cada vez, sem repetir automaticamente uma alteração incerta. */
export function saveNotificationPreference(token, event, channel, enabled) {
  if (!event?.channels?.some((entry) => entry.channel === channel) || typeof enabled !== 'boolean')
    throw new Error('Preferência inválida.');
  return apiRequest('/notifications/preferences', {
    token,
    method: 'PUT',
    body: JSON.stringify({ preferences: [{ event_type: event.event_type, channel, enabled }] }),
  });
}
/** Traduz eventos conhecidos e mantém legíveis futuros eventos sem inventar canais. */
export function notificationEventLabel(type) {
  return (
    {
      ACCOUNT_REGISTERED: 'Criação da conta',
      PAYMENT_APPROVED: 'Pagamento aprovado',
      ORDER_READY_FOR_PICKUP: 'Encomenda pronta para levantamento',
      DELIVERY_PERSON_ASSIGNED: 'Entregador atribuído',
      ORDER_PICKED_UP: 'Encomenda recolhida na loja',
      DELIVERY_IN_TRANSIT: 'Entrega em transporte',
      DELIVERY_DELIVERED: 'Entrega concluída',
      DELIVERY_FAILED: 'Falha na entrega',
      REFUND_APPROVED: 'Reembolso aprovado',
      REFUND_PROCESSING: 'Reembolso em processamento',
      REFUND_FAILED: 'Falha no reembolso',
      REFUNDED: 'Reembolso concluído',
      RETURN_PICKUP_FAILED: 'Falha na recolha da devolução',
      RETURN_PICKUP_RETRY_SCHEDULED: 'Nova tentativa de recolha',
      RETURN_PICKUP_REASSIGNED: 'Recolha reatribuída',
      RETURN_PICKUP_CANCELLED: 'Recolha cancelada',
      RETURN_PICKUP_ADDRESS_CORRECTION_REQUESTED: 'Pedido de correção da morada de recolha',
      RETURN_PICKUP_ADDRESS_CORRECTED: 'Morada de recolha corrigida',
      ORDER_COLLECTED_BY_CLIENT: 'Levantamento concluído na loja',
    }[type] || 'Outra atualização'
  );
}
