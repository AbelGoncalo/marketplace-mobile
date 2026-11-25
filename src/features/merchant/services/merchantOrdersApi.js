import { apiRequest } from '@/services/http/apiClient';

/** Estados comerciais permitidos para a filtragem da lista. */
export const merchantOrderStates = [
  { value: '', label: 'Todas as encomendas' },
  { value: 'AWAITING_PREPARATION', label: 'A aguardar preparação' },
  { value: 'PREPARING', label: 'Em preparação' },
  { value: 'READY_FOR_PICKUP', label: 'Pronta para recolha ou levantamento' },
  { value: 'HANDED_TO_CARRIER', label: 'Entregue ao transportador' },
  { value: 'COLLECTED_BY_CLIENT', label: 'Levantada pelo cliente' },
];
/** Valida identificadores e páginas antes de construir rotas privadas. */
function id(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new Error('Referência de encomenda inválida.');
  return Number(value);
}
/** Filtra e pagina no servidor, preservando o isolamento por lojista. */
export function getMerchantOrders(token, page = 1, status = '') {
  if (!merchantOrderStates.some((entry) => entry.value === status))
    throw new Error('Estado inválido.');
  return apiRequest(
    `/supplier/orders?page=${id(page)}&per_page=15${status ? `&fulfillment_status=${status}` : ''}`,
    { token },
  );
}
/** Obtém os produtos históricos e as ações permitidas para uma encomenda própria. */
export function getMerchantOrder(token, orderId) {
  return apiRequest(`/supplier/orders/${id(orderId)}`, { token });
}
/** Só admite as duas transições aprovadas para esta etapa, sem repetição automática. */
export function prepareMerchantOrder(token, order, action, permissions) {
  const actions = {
    START_PREPARATION: 'start-preparation',
    MARK_READY_FOR_PICKUP: 'ready-for-pickup',
  };
  if (
    !Object.hasOwn(actions, action) ||
    !order.allowed_actions?.includes(action) ||
    !permissions?.includes('supplier-orders.fulfillment')
  )
    throw new Error('Esta ação não está disponível para a encomenda.');
  return apiRequest(`/supplier/orders/${id(order.id)}/${actions[action]}`, {
    token,
    method: 'PATCH',
  });
}
/** Não confunde preparação, estado do pagamento e recebimento pelo cliente. */
export function merchantOrderStatus(status) {
  return (
    merchantOrderStates.find((entry) => entry.value === status && status)?.label ||
    'Estado em atualização'
  );
}

/** A passagem ao entregador exige a permissão da loja e a ação devolvida pela API. */
export function merchantHandover(token, order, action, permissions) {
  const routes = {
    CONFIRM_HANDOVER: ['confirm-handover', 'PATCH'],
    REGENERATE_PICKUP_CODE: ['pickup-code/regenerate', 'POST'],
  };
  if (
    !Object.hasOwn(routes, action) ||
    !order.allowed_actions?.includes(action) ||
    !permissions?.includes('supplier-orders.fulfillment')
  )
    throw new Error('Esta ação não está disponível para a encomenda.');
  const [route, method] = routes[action];
  return apiRequest(`/supplier/orders/${id(order.id)}/${route}`, { token, method });
}
/** O Cliente apresenta o código em loja; o Lojista valida-o e conclui o levantamento. */
export function confirmCustomerPickup(token, order, code, permissions) {
  if (
    !order.allowed_actions?.includes('CONFIRM_CUSTOMER_PICKUP') ||
    !permissions?.includes('supplier-orders.fulfillment')
  )
    throw new Error('Esta ação não está disponível para a encomenda.');
  if (!/^\d{6}$/.test(String(code)))
    throw new Error('Introduza os seis algarismos do código apresentado pelo Cliente.');
  return apiRequest(`/supplier/orders/${id(order.id)}/confirm-customer-pickup`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ confirmation_code: String(code) }),
  });
}
