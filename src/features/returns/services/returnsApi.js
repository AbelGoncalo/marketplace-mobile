import { attachmentFormData } from '@/features/returns/services/attachmentFiles';
import { apiRequest } from '@/services/http/apiClient';

/** Motivos aceites pela API, traduzidos para o formulário do Cliente. */
export const returnReasons = [
  { value: 'DAMAGED', label: 'Produto danificado' },
  { value: 'WRONG_ITEM', label: 'Produto diferente do pedido' },
  { value: 'NOT_AS_DESCRIBED', label: 'Não corresponde à descrição' },
  { value: 'SIZE_OR_VARIANT', label: 'Tamanho ou variante inadequados' },
  { value: 'MISSING_PARTS', label: 'Faltam peças ou acessórios' },
  { value: 'DEFECTIVE', label: 'Produto com defeito' },
  { value: 'CHANGE_OF_MIND', label: 'Mudei de ideias' },
  { value: 'OTHER', label: 'Outro motivo' },
];

/** Rejeita identificadores e páginas inválidos antes de construir o caminho privado. */
export function returnId(value) {
  const id = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error('O identificador da devolução é inválido.');
  return id;
}

/** Partilha paginação real do servidor, sem acumular dados de contas diferentes. */
function pagePath(path, page) {
  return `${path}?page=${returnId(page)}&per_page=15`;
}

/** Lista pedidos privados do Cliente com os metadados de paginação. */
export function getReturns(token, page = 1) {
  return apiRequest(pagePath('/client/returns', page), { token });
}

/** Consulta exclusivamente a fonte oficial de produtos elegíveis, sem calcular prazos localmente. */
export function getEligibleReturnItems(token, page = 1) {
  return apiRequest(pagePath('/client/returns/eligible-items', page), { token });
}

/** Consulta um pedido próprio; a API confirma a propriedade e o estado atual. */
export function getReturn(token, id) {
  return apiRequest(`/client/returns/${returnId(id)}`, { token });
}

/** Valida quantidade inteira e regras do formulário sem substituir a verificação final da API. */
export function createReturnPayload(item, values) {
  if (!item?.can_request_return)
    throw new Error('Este produto não está disponível para devolução.');
  const quantity =
    typeof values.quantity === 'string' && /^[1-9]\d*$/.test(values.quantity)
      ? Number(values.quantity)
      : values.quantity;
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error('Indique uma quantidade inteira superior a zero.');
  if (
    !Number.isSafeInteger(Number(item.returnable_quantity)) ||
    quantity > Number(item.returnable_quantity)
  )
    throw new Error('A quantidade excede o disponível para devolução.');
  if (!returnReasons.some((reason) => reason.value === values.reason))
    throw new Error('Selecione o motivo da devolução.');
  const description = typeof values.description === 'string' ? values.description.trim() : '';
  if ([...description].length < 10 || [...description].length > 5000)
    throw new Error('Descreva o motivo com 10 a 5000 caracteres.');
  return {
    order_id: returnId(item.order_id),
    order_item_id: returnId(item.order_item_id),
    quantity,
    reason: values.reason,
    description,
  };
}

/** Envia o pedido e anexos opcionais numa só operação, sem repetição automática. */
export function createReturn(token, item, values) {
  const body = createReturnPayload(item, values);
  const files = values.attachments || [];
  const multipart = files.length > 0;
  return apiRequest('/client/returns', {
    token,
    method: 'POST',
    body: multipart ? attachmentFormData(body, files) : JSON.stringify(body),
    ...(multipart ? { timeoutMs: 120000 } : {}),
  });
}

/** Cancela somente com permissão explícita e motivo; uma falha não desencadeia repetição automática. */
export function cancelReturn(token, request, reason) {
  const id = returnId(request?.id);
  if (!request.allowed_actions?.includes('CANCEL'))
    throw new Error('Este pedido já não permite cancelamento.');
  const text = typeof reason === 'string' ? reason.trim() : '';
  if ([...text].length < 5 || [...text].length > 1000)
    throw new Error('Indique um motivo de cancelamento com 5 a 1000 caracteres.');
  return apiRequest(`/client/returns/${id}/cancel`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ reason: text }),
  });
}

/** Mostra a validação específica da API em vez de uma mensagem genérica do formulário. */
export function returnError(error) {
  const fields = Object.values(error.errors || {})
    .flat()
    .filter((value) => typeof value === 'string');
  return fields.length ? fields.join('\n') : error.message || 'Não foi possível concluir o pedido.';
}

/** Uma resposta perdida ou erro interno pode ter ocorrido depois de a alteração ser guardada. */
export function returnOutcomeUnknown(error) {
  return error.status === 0 || error.status >= 500;
}
