import { apiRequest } from '@/services/http/apiClient';
import { synchronizePreview } from '@/features/checkout/services/checkoutFlow';

/** Lista as moradas que pertencem ao Cliente autenticado. */
export function getAddresses(token) {
  return apiRequest('/client/addresses', { token });
}

/** Guarda uma morada sem enviar campos de identificação do proprietário. */
export function createAddress(token, values) {
  return apiRequest('/client/addresses', { token, method: 'POST', body: JSON.stringify(values) });
}

/** Consulta as modalidades e tarifas disponíveis para cada loja do carrinho. */
export function getDeliveryOptions(token, addressId) {
  return apiRequest(
    `/client/checkout/delivery-options?address_id=${encodeURIComponent(addressId)}`,
    { token },
  );
}

/** Cria ou recupera a mesma cotação quando o pedido é repetido. */
export async function previewCheckout(token, payload) {
  const response = await apiRequest('/client/checkout/preview', {
    token,
    includeResponseMetadata: true,
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return synchronizePreview(response.data, response.serverDate, response.receivedAt);
}

/** Confirma uma única compra usando sempre a mesma chave da tentativa persistida. */
export function confirmCheckout(token, payload) {
  return apiRequest('/client/checkout/confirm', {
    token,
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Atualiza só os campos editáveis da morada, deixando a API verificar propriedade e histórico. */
export function updateAddress(token, id, values) {
  if (!Number.isSafeInteger(Number(id)) || Number(id) < 1)
    throw new Error('A referência da morada é inválida.');
  return apiRequest(`/client/addresses/${Number(id)}`, {
    token,
    method: 'PUT',
    body: JSON.stringify({
      municipality_id: values.municipality_id,
      address: values.address,
      phone: values.phone,
    }),
  });
}
