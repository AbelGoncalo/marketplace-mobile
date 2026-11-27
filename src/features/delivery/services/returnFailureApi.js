import { attachmentFormData } from '@/features/returns/services/attachmentFiles';
import { apiRequest } from '@/services/http/apiClient';

const commonReasons = [
  { value: 'VEHICLE_BREAKDOWN', label: 'Avaria do veículo' },
  { value: 'ACCIDENT', label: 'Acidente' },
  { value: 'OTHER', label: 'Outro motivo' },
];
const pickupReasons = [
  { value: 'CLIENT_UNAVAILABLE', label: 'Cliente ausente ou indisponível' },
  { value: 'ADDRESS_NOT_FOUND', label: 'Endereço não encontrado' },
  { value: 'CLIENT_REFUSED', label: 'Cliente recusou a recolha' },
  { value: 'PRODUCT_NOT_READY', label: 'Artigo não preparado para recolha' },
  ...commonReasons,
];
const deliveryReasons = [
  { value: 'STORE_CLOSED', label: 'Loja fechada' },
  { value: 'STORE_REFUSED_RECEIPT', label: 'Loja recusou receber o artigo' },
  ...commonReasons,
];
/** A API de devoluções não publica REPORT_FAILURE em allowed_actions; os estados seguem transitionFor. */
export function returnFailureReasons(delivery) {
  if (delivery?.status === 'AWAITING_PICKUP') return pickupReasons;
  if (['PICKED_UP', 'IN_TRANSIT'].includes(delivery?.status)) return deliveryReasons;
  return [];
}
/** Valida a referência antes de consultar ou enviar para uma rota privada. */
function identifier(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new Error('Referência de devolução inválida.');
  return Number(value);
}
/** Valida motivo e observação para a fase apresentada, sem enviar campos estranhos ao contrato. */
export function returnFailurePayload(delivery, values) {
  if (!returnFailureReasons(delivery).some((reason) => reason.value === values?.reason))
    throw new Error('Selecione um motivo válido para a fase atual da devolução.');
  const observation = typeof values.observation === 'string' ? values.observation.trim() : '';
  if ([...observation].length > 3000)
    throw new Error('A observação não pode exceder 3000 caracteres.');
  return { reason: values.reason, ...(observation ? { observation } : {}) };
}
/** Consulta novamente a tarefa antes de um único envio; a API mantém a decisão final dentro da transação. */
export async function reportReturnFailure(token, delivery, values) {
  const id = identifier(delivery?.id);
  const payload = returnFailurePayload(delivery, values);
  const files = values.attachments ?? [];
  if (!Array.isArray(files)) throw new Error('Seleção de anexos inválida.');
  // Prepara os ficheiros antes da consulta para evitar enviar com uma seleção ilegível ou excessiva.
  const body = files.length ? attachmentFormData(payload, files) : JSON.stringify(payload);
  const current = await apiRequest(`/delivery-person/return-deliveries/${id}`, { token });
  if (current?.status !== delivery.status || !returnFailureReasons(current).length) {
    const error = new Error('O estado da devolução mudou. Atualize antes de comunicar uma falha.');
    error.requiresRefresh = true;
    throw error;
  }
  return apiRequest(`/delivery-person/return-deliveries/${id}/failure`, {
    token,
    method: 'POST',
    body,
    ...(files.length ? { timeoutMs: 120000 } : {}),
  });
}
