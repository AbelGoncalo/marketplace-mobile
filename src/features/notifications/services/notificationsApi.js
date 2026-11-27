import { apiRequest } from '@/services/http/apiClient';

/** Valida referências e páginas antes de construir caminhos privados. */
function validId(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new Error('Referência inválida.');
  return Number(value);
}
/** Consulta a paginação oficial e o total de não lidas, sem filtrar localmente páginas incompletas. */
export function getNotifications(token, page = 1, unread = false) {
  return apiRequest(`/notifications?page=${validId(page)}&per_page=15${unread ? '&read=0' : ''}`, {
    token,
  });
}
/** A API verifica o destinatário e trata a marcação repetida de forma idempotente. */
export function markNotification(token, id) {
  return apiRequest(`/notifications/${validId(id)}/read`, { token, method: 'PATCH' });
}
/** Marca a caixa da conta atual; não repete automaticamente a operação. */
export function markAllNotifications(token) {
  return apiRequest('/notifications/read-all', { token, method: 'PATCH' });
}
/** Reconhece apenas destinos internos e parâmetros válidos; nunca segue URLs recebidos. */
export function notificationTarget(notification) {
  const data = notification.data;
  if (data?.action === 'VIEW_ORDER_GROUP') {
    const reference = data.action_params?.reference;
    if (
      typeof reference === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)
    )
      return { pathname: '/(customer)/orders/[reference]', params: { reference } };
  }
  if (data?.action === 'VIEW_CLIENT_REFUND') {
    const id = data.action_params?.refund_request_id;
    if (/^[1-9]\d*$/.test(String(id)) && Number.isSafeInteger(Number(id)))
      return { pathname: '/(customer)/refunds/[id]', params: { id: Number(id) } };
  }
  // A API revalida a propriedade da devolução; o destino nunca usa URLs da mensagem.
  if (data?.action === 'VIEW_CLIENT_RETURN') {
    const id = data.action_params?.return_request_id;
    if (/^[1-9]\d*$/.test(String(id)) && Number.isSafeInteger(Number(id)))
      return { pathname: '/(customer)/returns/[id]', params: { id: Number(id) } };
  }
  return null;
}
