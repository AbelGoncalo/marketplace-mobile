import { cartItemCount } from '@/features/cart/utils/cartCounts';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/features/auth/context/AuthContext';
import { cartApi } from '@/features/cart/services/cartApi';

const CartContext = createContext(null);

/** Trocar de conta recria o estado para nunca apresentar o carrinho do utilizador anterior. */
export function CartProvider({ children }) {
  const { session, isLoading } = useAuth();
  return (
    <CartSession key={session?.token || 'guest'} session={session} authLoading={isLoading}>
      {children}
    </CartSession>
  );
}

/** Distribui o carrinho da API e bloqueia alterações enquanto outra operação decorre. */
function CartSession({ children, session, authLoading }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const mounted = useRef(false);
  const busy = useRef(false);
  const token = session?.token;
  const canShop = !session || session.user?.accountType === 'Cliente';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Atualiza o estado apenas se a resposta ainda pertencer à conta montada. */
  const execute = useCallback(
    async (operation) => {
      if (!canShop || authLoading)
        throw new Error('O carrinho está disponível para visitantes e contas de Cliente.');
      if (busy.current) throw new Error('Aguarde a atualização do carrinho.');
      busy.current = true;
      setPending(true);
      setError('');
      try {
        const next = await operation();
        if (mounted.current) setData(next);
        return next;
      } catch (requestError) {
        if (mounted.current) setError(requestError.message);
        throw requestError;
      } finally {
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [canShop, authLoading],
  );

  const refresh = useCallback(() => execute(() => cartApi.load(token)), [execute, token]);

  // Aguarda a sessão estabilizar e partilha o bloqueio com consultas disparadas pelo foco.
  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(() => {
        if (active && canShop && !authLoading && !busy.current) return refresh();
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refresh, canShop, authLoading]);

  const value = {
    data,
    error,
    pending,
    canShop,
    ready: Boolean(data),
    totalQuantity: Number(data?.cart?.total_quantity) || 0,
    // Os indicadores contam artigos distintos, não a soma das quantidades.
    totalItems: cartItemCount(data),
    /** Consulta o estado comercial atual sem repetir uma alteração que possa já ter sido aplicada. */
    refresh,
    /** Carrega a identidade visitante antes da primeira adição e devolve o carrinho confirmado. */
    addItem: (variantId, quantity) =>
      execute(async () => {
        await cartApi.load(token);
        return cartApi.add(token, variantId, quantity);
      }),
    /** Atualiza a quantidade absoluta de uma linha. */
    updateItem: (itemId, quantity) => execute(() => cartApi.update(token, itemId, quantity)),
    /** Remove uma linha e recebe novos totais calculados pelo servidor. */
    removeItem: (itemId) => execute(() => cartApi.remove(token, itemId)),
    /** Limpa todos os itens após confirmação explícita na interface. */
    clear: () => execute(() => cartApi.clear(token)),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

/** Garante que os componentes do carrinho estão dentro do provider. */
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart deve ser usado dentro de CartProvider.');
  return context;
}
