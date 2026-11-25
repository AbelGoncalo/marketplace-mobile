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
