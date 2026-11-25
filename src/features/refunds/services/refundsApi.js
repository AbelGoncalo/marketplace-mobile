import { apiRequest } from '@/services/http/apiClient';

/** Rejeita referências e páginas inválidas antes de construir caminhos privados. */
function refundId(value) {
  const id = typeof value === 'string' && /^[1-9]\d*$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error('A referência ou página do reembolso é inválida.');
  return id;
}

/** Consulta exclusivamente reembolsos da conta autenticada com paginação real. */
export function getRefunds(token, page = 1) {
  return apiRequest(`/client/refunds?page=${refundId(page)}&per_page=15`, { token });
}

/** Obtém valor e histórico oficiais, preservando erros de sessão e de autorização da API. */
export function getRefund(token, id) {
  return apiRequest(`/client/refunds/${refundId(id)}`, { token });
}

/** Separa a criação do processo da confirmação efetiva do reembolso financeiro. */
export function refundStatus(status) {
  const states = {
    PENDING: ['Pendente', 'warning', 'O processo foi criado e aguarda análise.'],
    UNDER_REVIEW: ['Em análise', 'info', 'O pedido de reembolso está a ser analisado.'],
    APPROVED: ['Aprovado', 'info', 'O reembolso foi aprovado e aguarda processamento.'],
    PROCESSING: ['Em processamento', 'info', 'O pagamento do reembolso está em processamento.'],
    REFUNDED: ['Reembolsado', 'success', 'O processamento do reembolso foi confirmado.'],
    FAILED: [
      'Falha no processamento',
      'warning',
      'O reembolso não foi concluído. Consulte os detalhes abaixo.',
    ],
    REJECTED: [
      'Rejeitado',
      'promotion',
      'O pedido de reembolso foi rejeitado. Consulte a decisão abaixo.',
    ],
    CANCELLED: ['Cancelado', 'warning', 'O processo de reembolso foi cancelado.'],
  };
  const [label, variant, description] = states[status] || [
    'Estado em atualização',
    'info',
    'Atualize para consultar o estado do reembolso.',
  ];
  return { label, variant, description };
}

/** Traduz tentativas financeiras sem confundir uma falha anterior com o estado atual do processo. */
export function refundTransactionStatus(status) {
  return (
    {
      PENDING: 'Pendente',
      PROCESSING: 'Em processamento',
      PENDING_CONFIRMATION: 'A aguardar confirmação',
      SUCCEEDED: 'Concluída',
      FAILED: 'Falhou',
    }[status] || 'Estado em atualização'
  );
}
