const orderStates = {
  PENDING: ['Pendente', 'warning'],
  CONFIRMED: ['Confirmada', 'info'],
  CANCELLED: ['Cancelada', 'promotion'],
  COMPLETED: ['Concluída', 'success'],
};
const paymentStates = {
  PENDING: ['Pagamento pendente', 'warning'],
  APPROVED: ['Pagamento aprovado', 'success'],
  REJECTED: ['Pagamento rejeitado', 'promotion'],
  REFUNDED: ['Pagamento reembolsado', 'info'],
};

/** Mantém separados o estado da compra e o estado do pagamento, sem inferir um a partir do outro. */
export function orderStatus(code, payment = false) {
  const state = (payment ? paymentStates : orderStates)[code];
  return {
    label: state?.[0] || (payment ? 'Pagamento em atualização' : 'Estado em atualização'),
    variant: state?.[1] || 'info',
  };
}

/** Formata datas sem apresentar Invalid Date quando falta informação no histórico. */
export function orderDate(value) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Data indisponível';
  return new Date(value).toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Respeita a moeda devolvida pela API sem alterar os valores comerciais. */
export function orderAmount(value, currency = 'AOA') {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)))
    return 'Valor indisponível';
  const unit = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : 'AOA';
  return `${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} ${unit}`;
}

/** Ordena uma cópia do histórico para não modificar os dados recebidos pela API. */
export function orderedTimeline(events = []) {
  return [...events].sort((a, b) => {
    const left = Date.parse(a.occurred_at);
    const right = Date.parse(b.occurred_at);
    return Number.isFinite(left) && Number.isFinite(right) ? left - right : 0;
  });
}
