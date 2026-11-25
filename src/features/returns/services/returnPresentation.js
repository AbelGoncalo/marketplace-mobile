const states = {
  REQUESTED: ['Pedido enviado', 'info'],
  UNDER_REVIEW: ['Em análise', 'warning'],
  APPROVED: ['Pedido aprovado', 'success'],
  REJECTED: ['Pedido rejeitado', 'promotion'],
  AWAITING_RETURN: ['A aguardar devolução', 'warning'],
  IN_TRANSIT: ['Em transporte', 'info'],
  RECEIVED: ['Produto recebido na loja', 'info'],
  INSPECTING: ['Em inspeção', 'warning'],
  ACCEPTED: ['Devolução aceite', 'success'],
  REFUSED: ['Devolução recusada', 'promotion'],
  CANCELLED: ['Pedido cancelado', 'info'],
};

/** Traduz o estado real do pedido sem o confundir com aprovação ou pagamento de reembolso. */
export function returnStatus(code) {
  const state = states[code];
  return { label: state?.[0] || 'Estado em atualização', variant: state?.[1] || 'info' };
}
