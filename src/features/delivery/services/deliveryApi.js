import { apiRequest } from '@/services/http/apiClient';

/** Valida referências privadas antes de construir os caminhos da API. */
function identifier(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new Error('Referência de entrega inválida.');
  return Number(value);
}
/** Consulta somente as entregas atribuídas à conta autenticada. */
export function getDeliveries(token, page = 1) {
  return apiRequest(`/delivery-person/deliveries?page=${identifier(page)}&per_page=15`, { token });
}
/** Obtém a entrega e as ações autorizadas pelo servidor. */
export function getDelivery(token, id) {
  return apiRequest(`/delivery-person/deliveries/${identifier(id)}`, { token });
}
/** Limita esta etapa à deslocação para a loja e à validação presencial da recolha. */
export function pickupAction(token, delivery, action, code = '') {
  const routes = { START_PICKUP: 'start-pickup', CONFIRM_PICKUP: 'confirm-pickup' };
  if (!Object.hasOwn(routes, action) || !delivery.allowed_actions?.includes(action))
    throw new Error('Esta ação não está disponível para a entrega.');
  if (action === 'CONFIRM_PICKUP' && !/^\d{6}$/.test(code))
    throw new Error('Introduza os seis algarismos do código apresentado pelo lojista.');
  return apiRequest(`/delivery-person/deliveries/${identifier(delivery.id)}/${routes[action]}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(action === 'CONFIRM_PICKUP' ? { pickup_code: code } : {}),
  });
}
/** Executa somente o transporte, a entrega ou a devolução autorizados pelo estado devolvido pela API. */
export function deliveryAction(token, delivery, action, data = {}) {
  const routes = {
    START_TRANSIT: 'start-transit',
    CONFIRM_DELIVERY: 'confirm-delivery',
    CONFIRM_RETURN_TO_STORE: 'confirm-return-to-store',
  };
  if (!Object.hasOwn(routes, action) || !delivery.allowed_actions?.includes(action))
    throw new Error('Esta ação não está disponível para a entrega.');
  const recipientName = String(data.recipient_name || '').trim();
  const confirmationCode = String(data.confirmation_code || '');
  const needsRecipient = action === 'CONFIRM_DELIVERY' || action === 'CONFIRM_RETURN_TO_STORE';
  if (needsRecipient && !recipientName)
    throw new Error(
      action === 'CONFIRM_DELIVERY'
        ? 'Indique o nome de quem recebeu a encomenda.'
        : 'Indique o nome de quem recebeu os produtos na loja.',
    );
  if (needsRecipient && recipientName.length > 180)
    throw new Error('O nome do destinatário não pode exceder 180 caracteres.');
  if (action === 'CONFIRM_DELIVERY' && !/^\d{6}$/.test(confirmationCode))
    throw new Error('Introduza os seis algarismos do código apresentado pelo cliente.');
  return apiRequest(`/delivery-person/deliveries/${identifier(delivery.id)}/${routes[action]}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(
      action === 'CONFIRM_DELIVERY'
        ? { recipient_name: recipientName, confirmation_code: confirmationCode }
        : action === 'CONFIRM_RETURN_TO_STORE'
          ? { recipient_name: recipientName }
          : {},
    ),
  });
}
/** Comunica uma falha justificada; quem decide o próximo passo é a transportadora. */
export function reportDeliveryFailure(token, delivery, reason) {
  if (!delivery.allowed_actions?.includes('REPORT_FAILURE'))
    throw new Error('Esta ação não está disponível para a entrega.');
  const text = String(reason || '').trim();
  if (!text) throw new Error('Indique o motivo da falha na entrega.');
  if (text.length > 2000) throw new Error('O motivo da falha não pode exceder 2000 caracteres.');
  return apiRequest(`/delivery-person/deliveries/${identifier(delivery.id)}/report-failure`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ reason: text }),
  });
}
/** Apresenta estados operacionais sem confundir recolha com entrega ao cliente. */
export function deliveryStatus(status) {
  return (
    {
      ASSIGNED: 'Atribuída',
      PICKUP_PENDING: 'Recolha iniciada',
      PICKED_UP: 'Recolhida na loja',
      IN_TRANSIT: 'A caminho do cliente',
      DELIVERED: 'Entregue ao cliente',
      DELIVERY_FAILED: 'Falha na entrega',
      RETURNING_TO_STORE: 'A regressar à loja',
      RETURNED_TO_STORE: 'Devolvida à loja',
      CANCELLED: 'Cancelada',
    }[status] || 'Estado em atualização'
  );
}
