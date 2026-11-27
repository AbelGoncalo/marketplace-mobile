import { apiRequest } from '@/services/http/apiClient';
import { returnId } from '@/features/returns/services/returnsApi';

/** Consulta a logística existente; a ausência é tratada pelo detalhe do pedido, sem esconder erros. */
export function getReturnDelivery(token, id) {
  return apiRequest(`/client/returns/${returnId(id)}/delivery`, { token });
}

/** Só permite escolher a modalidade quando o pedido e as ações oficiais o autorizam. */
export function chooseReturnDelivery(token, request, delivery, method, addressId) {
  const allowed =
    request.status === 'AWAITING_RETURN' &&
    (request.allowed_actions?.includes('CHOOSE_DELIVERY_METHOD') ||
      delivery?.allowed_actions?.includes('SELECT_RETURN_METHOD'));
  if (!allowed) throw new Error('Este pedido não permite escolher a modalidade.');
  if (!['STORE_DROPOFF', 'CARRIER_PICKUP'].includes(method))
    throw new Error('Escolha uma modalidade válida.');
  const body = { method };
  if (method === 'CARRIER_PICKUP') body.pickup_address_id = returnId(addressId);
  return apiRequest(`/client/returns/${returnId(request.id)}/delivery`, {
    token,
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** Gera um código por ação explícita e compensa a diferença de relógios com a data da resposta. */
export async function issueReturnDeliveryCode(token, request, delivery, kind) {
  const action = { dropoff: 'ISSUE_DROPOFF_CODE', pickup: 'ISSUE_PICKUP_CODE' }[kind];
  if (
    request.status !== 'AWAITING_RETURN' ||
    !action ||
    !delivery?.allowed_actions?.includes(action)
  )
    throw new Error('O código ainda não está disponível para esta devolução.');
  const response = await apiRequest(`/client/returns/${returnId(request.id)}/${kind}-code`, {
    token,
    method: 'POST',
    includeResponseMetadata: true,
  });
  const data = response.data;
  const expiry = Date.parse(data?.expires_at);
  const server = Date.parse(response.serverDate);
  if (!data?.confirmation_code || !Number.isFinite(expiry))
    throw new Error('Não foi possível confirmar o código. Gerar novamente invalida o anterior.');
  return {
    ...data,
    deadline: Number.isFinite(server) ? response.receivedAt + expiry - server : expiry,
  };
}

/** Traduz estados logísticos sem confundir a entrega do artigo com a decisão de reembolso. */
export function returnDeliveryStatus(status) {
  return (
    {
      PENDING: 'A aguardar',
      SCHEDULED: 'Recolha agendada',
      ACCEPTED: 'Recolha aceite',
      AWAITING_PICKUP: 'A aguardar recolha',
      PICKED_UP: 'Produto recolhido',
      IN_TRANSIT: 'Em transporte',
      DELIVERED: 'Entregue à loja',
      PICKUP_FAILED: 'Recolha não concluída',
      DELIVERY_FAILED: 'Entrega não concluída',
      CANCELLED: 'Transporte cancelado',
    }[status] || 'Estado em atualização'
  );
}

/** A correção só surge quando a API a autoriza explicitamente para a recolha falhada. */
export function canCorrectPickupAddress(delivery) {
  return (
    delivery?.method === 'CARRIER_PICKUP' &&
    delivery.status === 'PICKUP_FAILED' &&
    delivery.allowed_actions?.includes('UPDATE_PICKUP_ADDRESS') === true
  );
}
/** Revalida a autorização e envia uma única correção; a API confirma a propriedade da morada. */
export async function correctPickupAddress(token, request, delivery, addressId) {
  if (!canCorrectPickupAddress(delivery))
    throw new Error('O Centro ainda não solicitou a correção desta morada.');
  const id = returnId(request.id);
  const selected = returnId(addressId);
  const current = await getReturnDelivery(token, id);
  if (!canCorrectPickupAddress(current)) {
    const error = new Error(
      'O pedido de correção mudou. Atualize o acompanhamento antes de continuar.',
    );
    error.requiresRefresh = true;
    throw error;
  }
  return apiRequest(`/client/returns/${id}/pickup-address`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ pickup_address_id: selected }),
  });
}
