import { apiRequest } from '@/services/http/apiClient';
import {
  getGuestCartToken,
  removeGuestCartToken,
  saveGuestCartToken,
} from '@/features/cart/services/cartStorage';

/** Valida quantidades antes de enviar alterações ao servidor. */
export function validQuantity(value) {
  const quantity = Number(value);
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new Error('Introduza uma quantidade inteira superior a zero.');
  return quantity;
}

/** Valida identificadores sem permitir construir caminhos arbitrários da API. */
function validId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('O identificador do item é inválido.');
  return id;
}

/** Serializa operações para impedir carrinhos visitantes duplicados e totais fora de ordem. */
export function createCartService() {
  let queue = Promise.resolve();
  let guestToken;

  /** Reutiliza a credencial em memória caso a persistência precise de ser repetida. */
  async function readToken() {
    if (guestToken === undefined) guestToken = await getGuestCartToken();
    return guestToken;
  }

  /** Mantém a operação seguinte disponível mesmo depois de uma falha de rede. */
  function enqueue(operation) {
    const pending = queue.then(operation);
    queue = pending.catch(() => {});
    return pending;
  }

  /** Funde o visitante antes de usar a conta; só descarta tokens cuja expiração foi confirmada. */
  async function prepare(token) {
    const visitor = await readToken();
    if (!token || !visitor) return;
    try {
      await apiRequest('/cart/merge', {
        token,
        method: 'POST',
        body: JSON.stringify({ cart_token: visitor }),
      });
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    await removeGuestCartToken();
    guestToken = null;
  }

  /** Envia a identidade correta e persiste tokens emitidos antes da próxima alteração. */
  function request(token, path, options = {}) {
    return enqueue(async () => {
      await prepare(token);
      const visitor = token ? null : await readToken();
      if (visitor) await saveGuestCartToken(visitor);
      const data = await apiRequest(path, {
        ...options,
        ...(token ? { token } : { headers: visitor ? { 'X-Cart-Token': visitor } : {} }),
      });
      if (!token && data?.cart_token) {
        guestToken = data.cart_token;
        await saveGuestCartToken(guestToken);
      }
      return data;
    });
  }

  return {
    /** Carrega ou cria o carrinho atual e incorpora compras anteriores do visitante. */
    load: (token) => request(token, '/cart'),
    /** Adiciona unidades à oferta comercial exata da loja selecionada. */
    add: (token, variantId, quantity) =>
      request(token, '/cart/items', {
        method: 'POST',
        body: JSON.stringify({
          store_product_variant_id: validId(variantId),
          quantity: validQuantity(quantity),
        }),
      }),
    /** Substitui a quantidade; o servidor volta a validar disponibilidade e preço. */
    update: (token, itemId, quantity) =>
      request(token, `/cart/items/${validId(itemId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity: validQuantity(quantity) }),
      }),
    /** Remove apenas o item pertencente ao carrinho atual. */
    remove: (token, itemId) =>
      request(token, `/cart/items/${validId(itemId)}`, { method: 'DELETE' }),
    /** Esvazia o carrinho sem invalidar a credencial do visitante. */
    clear: (token) => request(token, '/cart/items', { method: 'DELETE' }),
  };
}

// Uma fila partilhada também protege a transição visitante → conta autenticada.
export const cartApi = createCartService();
