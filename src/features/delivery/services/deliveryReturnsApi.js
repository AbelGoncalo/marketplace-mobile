import { apiRequest } from '@/services/http/apiClient';

/** Estados logísticos da recolha reversa, usados no filtro e na apresentação. */
export const returnDeliveryStates = [
  { value: '', label: 'Todas as recolhas' },
  { value: 'PENDING', label: 'Pendente' },
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'ACCEPTED', label: 'Aceite' },
  { value: 'AWAITING_PICKUP', label: 'A aguardar recolha' },
  { value: 'PICKED_UP', label: 'Recolhida' },
  { value: 'IN_TRANSIT', label: 'A caminho da loja' },
  { value: 'DELIVERED', label: 'Entregue na loja' },
  { value: 'PICKUP_FAILED', label: 'Recolha falhada' },
  { value: 'DELIVERY_FAILED', label: 'Entrega falhada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];
/** Valida referências e páginas antes de construir os caminhos privados. */
function identifier(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new Error('Referência de recolha inválida.');
  return Number(value);
}
/** Consulta somente as recolhas reversas atribuídas à conta autenticada. */
export function getReturnDeliveries(token, page = 1, status = '') {
  if (!returnDeliveryStates.some((entry) => entry.value === status))
    throw new Error('Estado inválido.');
  return apiRequest(
    `/delivery-person/return-deliveries?page=${identifier(page)}&per_page=20${
      status ? `&status=${status}` : ''
    }`,
    { token },
  );
}
/** Devolve null quando a recolha já não está acessível à conta; preserva erros de rede e sessão. */
export function getReturnDelivery(token, id) {
  return apiRequest(`/delivery-person/return-deliveries/${identifier(id)}`, { token }).catch(
    (error) => {
      // Uma nova tentativa pode retirar a atribuição anterior; não revela dados nem a causa de outro 404.
      if (error.status === 404) return null;
      throw error;
    },
  );
}
/** Executa uma única transição autorizada, enviando apenas os campos aceites. */
export function returnDeliveryAction(token, delivery, action, code = '') {
  const routes = {
    CONFIRM_PICKUP: ['confirm-pickup', true],
    START_TRANSIT: ['start-transit', false],
    CONFIRM_STORE_DELIVERY: ['confirm-store-delivery', true],
  };
  if (!Object.hasOwn(routes, action) || !delivery.allowed_actions?.includes(action))
    throw new Error('Esta ação não está disponível para a recolha.');
  const [route, needsCode] = routes[action];
  if (needsCode && !/^\d{6}$/.test(String(code)))
    throw new Error(
      action === 'CONFIRM_PICKUP'
        ? 'Introduza os seis algarismos apresentados pelo Cliente.'
        : 'Introduza os seis algarismos emitidos pelo Lojista.',
    );
  return apiRequest(`/delivery-person/return-deliveries/${identifier(delivery.id)}/${route}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(needsCode ? { confirmation_code: String(code) } : {}),
  });
}
/** Distingue a recolha ao Cliente da entrega na loja, sem reutilizar estados de encomenda. */
export function returnDeliveryStatus(status) {
  return (
    returnDeliveryStates.find((entry) => entry.value === status && status)?.label ||
    'Estado em atualização'
  );
}
