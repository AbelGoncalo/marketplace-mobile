import { apiRequest } from '@/services/http/apiClient';

/** Categorias oficiais da API, com nomes compreensíveis no formulário do Cliente. */
export const complaintTypes = [
  { value: 'PRODUCT', label: 'Produto' },
  { value: 'STORE', label: 'Loja' },
  { value: 'DELIVERY', label: 'Entrega' },
  { value: 'PAYMENT', label: 'Pagamento' },
  { value: 'OTHER', label: 'Outro' },
];

/** Impede caminhos inválidos e referências que excedem a precisão dos números JavaScript. */
function validId(value) {
  const id = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error('A referência da reclamação é inválida.');
  return id;
}

/** Lista apenas a página pedida dos processos da conta autenticada. */
export function getComplaints(token, page = 1) {
  return apiRequest(`/client/complaints?page=${validId(page)}&per_page=15`, { token });
}

/** Consulta o detalhe; a API confirma a propriedade da reclamação. */
export function getComplaint(token, id) {
  return apiRequest(`/client/complaints/${validId(id)}`, { token });
}

/** Mostra somente encomendas explicitamente autorizadas pela API para uma nova ocorrência. */
export function eligibleComplaintOrders(purchase) {
  return (purchase?.orders || []).filter((order) => order.can_open_complaint === true);
}

/** Compara o âmbito exato: encomenda inteira não equivale a um artigo específico. */
export function findOngoingComplaint(order, itemId, type) {
  if (!type) return null;
  const selectedItem = itemId ? String(itemId) : null;
  return (
    (order?.ongoing_complaints || []).find(
      (complaint) =>
        complaint.type === type &&
        (complaint.order_item_id == null ? null : String(complaint.order_item_id)) === selectedItem,
    ) || null
  );
}

/** Exige uma encomenda obtida da conta e valida o item dentro dessa mesma encomenda. */
export function createComplaint(token, purchase, values) {
  const order = purchase?.orders?.find((entry) => String(entry.id) === String(values.orderId));
  if (!order) throw new Error('Selecione a encomenda da loja nesta compra.');
  if (order.can_open_complaint !== true)
    throw new Error(
      'Esta encomenda não está disponível para uma nova reclamação. Consulte as reclamações em curso.',
    );
  const item = values.itemId
    ? order.items?.find((entry) => String(entry.id) === String(values.itemId))
    : null;
  if (values.itemId && !item) throw new Error('O artigo não pertence à encomenda selecionada.');
  if (!complaintTypes.some((entry) => entry.value === values.type))
    throw new Error('Selecione a categoria da reclamação.');
  if (findOngoingComplaint(order, values.itemId, values.type))
    throw new Error(
      'Já existe uma reclamação em curso para este artigo e categoria. Consulte a reclamação existente.',
    );
  const subject = typeof values.subject === 'string' ? values.subject.trim() : '';
  const description = typeof values.description === 'string' ? values.description.trim() : '';
  if (!subject || [...subject].length > 180)
    throw new Error('Indique um assunto até 180 caracteres.');
  if ([...description].length < 10 || [...description].length > 5000)
    throw new Error('Descreva a situação com 10 a 5000 caracteres.');
  return apiRequest('/client/complaints', {
    token,
    method: 'POST',
    body: JSON.stringify({
      order_id: validId(order.id),
      ...(item ? { order_item_id: validId(item.id) } : {}),
      type: values.type,
      subject,
      description,
    }),
  });
}

/** Cancela somente enquanto aberta e autorizada; nunca repete automaticamente uma operação. */
export function cancelComplaint(token, complaint, reason) {
  if (complaint.status !== 'OPEN' || !complaint.allowed_actions?.includes('CANCEL'))
    throw new Error('Esta reclamação já não permite cancelamento.');
  const text = typeof reason === 'string' ? reason.trim() : '';
  if ([...text].length < 5 || [...text].length > 1000)
    throw new Error('Indique um motivo com 5 a 1000 caracteres.');
  return apiRequest(`/client/complaints/${validId(complaint.id)}/cancel`, {
    token,
    method: 'PATCH',
    body: JSON.stringify({ reason: text }),
  });
}

/** Traduz estados sem sugerir que uma reclamação resolvida equivale a reembolso. */
export function complaintStatus(status) {
  const values = {
    OPEN: ['Aberta', 'info'],
    IN_REVIEW: ['Em análise', 'warning'],
    WAITING_CUSTOMER: ['A aguardar informação do cliente', 'warning'],
    RESOLVED: ['Resolvida', 'success'],
    REJECTED: ['Rejeitada', 'promotion'],
    CANCELLED: ['Cancelada', 'info'],
  };
  const [label, variant] = values[status] || ['Estado em atualização', 'info'];
  return { label, variant };
}
