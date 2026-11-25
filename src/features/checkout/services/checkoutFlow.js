/** Gera uma chave de deduplicação, sem a usar como credencial de autenticação. */
export function checkoutKey() {
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Constrói uma seleção completa sem aceitar lojas com modalidades por escolher. */
export function deliverySelections(stores, choices) {
  if (!stores.length) throw new Error('O carrinho está vazio.');
  return stores.map(({ store, options }) => {
    const option = options[Number(choices[store.id])];
    if (choices[store.id] === undefined || !option)
      throw new Error('Escolha a entrega de todas as lojas.');
    return {
      store_id: store.id,
      delivery_method: option.delivery_method,
      service_type: option.service_type,
      carrier_delivery_rate_id: option.carrier_delivery_rate_id,
    };
  });
}

/** Normaliza a precisão de datas ISO da API para formatos suportados no dispositivo. */
export function checkoutTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) return NaN;
  return Date.parse(value.trim().replace(/(\.\d{3})\d+(?=Z|[+-]\d{2}:?\d{2}$)/i, '$1'));
}

/** Converte a validade do servidor num prazo local equivalente, sem inventar minutos adicionais. */
export function synchronizePreview(quote, serverDate, receivedAt) {
  const expiry = checkoutTimestamp(quote?.expires_at);
  const server = checkoutTimestamp(serverDate);
  if (!Number.isFinite(expiry) || !Number.isFinite(server) || !Number.isFinite(receivedAt))
    return quote;
  return { ...quote, client_expires_at: receivedAt + (expiry - server) };
}

/** Usa o prazo sincronizado quando existe e mantém compatibilidade com cotações já guardadas. */
export function previewDeadline(preview) {
  return Number.isFinite(preview?.client_expires_at)
    ? preview.client_expires_at
    : checkoutTimestamp(preview?.expires_at);
}

/** Datas ilegíveis não provam expiração: nesses casos a API decide ao confirmar. */
export function previewExpired(preview, now = Date.now()) {
  if (preview?.status === 'EXPIRED' || preview?.status === 'CANCELLED') return true;
  const expiry = previewDeadline(preview);
  return Number.isFinite(expiry) && expiry <= now;
}

/** Renova a cotação mantendo as escolhas, sem substituir uma confirmação de resultado desconhecido. */
export function renewCheckoutAttempt(attempt) {
  if (attempt.confirmStarted || attempt.receipt) {
    throw new Error('Retome a confirmação existente antes de iniciar outro resumo.');
  }
  return {
    previewPayload: { ...attempt.previewPayload, idempotency_key: checkoutKey() },
    confirmKey: checkoutKey(),
    confirmStarted: false,
  };
}

/** Coordena persistência e transporte sem alterar chaves quando uma operação falha. */
export function createCheckoutFlow({ save, preview, confirm }) {
  return {
    /** Guarda as escolhas antes do pedido; repetir recupera a mesma cotação. */
    async review(attempt) {
      await save(attempt);
      const quote = await preview(attempt.previewPayload);
      const next = { ...attempt, preview: quote };
      await save(next);
      return next;
    },
    /** Preserva uma confirmação pendente até a API devolver o resultado definitivo. */
    async confirm(attempt) {
      if (attempt.receipt) return attempt;
      if (!attempt.confirmStarted && previewExpired(attempt.preview))
        throw new Error('O resumo expirou. Gere um novo resumo.');
      const pending = { ...attempt, confirmStarted: true };
      await save(pending);
      const receipt = await confirm({
        preview_token: attempt.preview.preview_token,
        idempotency_key: attempt.confirmKey,
        payment_method: 'REFERENCE',
      });
      const next = { ...pending, receipt };
      await save(next);
      return next;
    },
  };
}
