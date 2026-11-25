import { apiRequest } from '@/services/http/apiClient';

/** Valida referências UUID antes de construir caminhos de compras do Cliente. */
export function validOrderReference(reference) {
  if (
    typeof reference !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)
  ) {
    throw new Error('A referência da compra é inválida.');
  }
  return reference;
}

/** Consulta apenas a página pedida e preserva os metadados de paginação da API. */
export function getOrders(token, page = 1, complaintEligible = false) {
  if (!Number.isSafeInteger(page) || page < 1)
    throw new Error('A página de encomendas é inválida.');
  // O filtro é aplicado na API antes da paginação; a consulta normal mantém o contrato anterior.
  const eligibility = complaintEligible ? '&complaint_eligible=1' : '';
  return apiRequest(`/client/order-groups?page=${page}&per_page=15${eligibility}`, { token });
}

/** Distingue uma compra inexistente ou inacessível de uma falha temporária de rede. */
async function orderRequest(token, reference, suffix = '') {
  const id = validOrderReference(reference);
  try {
    return await apiRequest(`/client/order-groups/${id}${suffix}`, { token });
  } catch (error) {
    if (error.status === 404)
      throw new Error('Esta compra não foi encontrada ou não pertence à sua conta.');
    throw error;
  }
}

/** Obtém itens, totais, morada e estados da compra pertencente ao Cliente. */
export function getOrder(token, reference) {
  return orderRequest(token, reference);
}

/** Consulta o acompanhamento público da logística, sem emitir códigos de entrega. */
export function getOrderTracking(token, reference) {
  return orderRequest(token, reference, '/tracking');
}

/** Identifica a ação permitida pelo estado atual, sem antecipar a preparação da loja. */
export function orderCodeAction(order) {
  if (
    order.delivery?.delivery_method === 'PICKUP' &&
    order.allowed_actions?.includes('ISSUE_STORE_PICKUP_CODE')
  ) {
    return { kind: 'pickup', id: order.id };
  }
  if (
    order.delivery?.delivery_method === 'DELIVERY' &&
    order.delivery.operational_status === 'IN_TRANSIT' &&
    order.delivery.delivery_id
  ) {
    return { kind: 'delivery', id: order.delivery.delivery_id };
  }
  return null;
}

/** Emite apenas por ação explícita; não repete automaticamente pedidos que invalidam códigos. */
export async function issueOrderCode(token, reference, action) {
  const id = validOrderReference(reference);
  if (
    !['pickup', 'delivery'].includes(action?.kind) ||
    !Number.isSafeInteger(action.id) ||
    action.id < 1
  ) {
    throw new Error('A ação de confirmação é inválida.');
  }
  const suffix =
    action.kind === 'pickup'
      ? `/orders/${action.id}/pickup-code`
      : `/deliveries/${action.id}/confirmation-code`;
  const response = await apiRequest(`/client/order-groups/${id}${suffix}`, {
    token,
    method: 'POST',
    includeResponseMetadata: true,
  });
  const result = action.kind === 'pickup' ? response.data : response.data?.delivery_confirmation;
  if (!result?.confirmation_code || !result.expires_at) {
    throw new Error('Não foi possível obter o código. Gerar novamente invalida o anterior.');
  }
  // Compensa diferenças entre o relógio do servidor e o dispositivo, sem inventar um prazo.
  const expiry = Date.parse(result.expires_at);
  const server = Date.parse(response.serverDate);
  return {
    ...result,
    deadline: Number.isFinite(server) ? response.receivedAt + expiry - server : expiry,
  };
}
