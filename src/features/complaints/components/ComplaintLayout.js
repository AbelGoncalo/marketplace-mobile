import { useEffect, useRef, useState } from 'react';

import { OrderAccess } from '@/features/orders/components/OrderAccess';
import { ReturnLayout, ReturnFeedback } from '@/features/returns/components/ReturnLayout';
import { returnError, returnOutcomeUnknown } from '@/features/returns/services/returnsApi';

/** Reutiliza a proteção de Cliente com destino interno próprio para retomar a entrada. */
export function ComplaintAccess({ children }) {
  return (
    <OrderAccess
      title="As minhas reclamações"
      description="Entre para consultar as suas reclamações."
      returnTo="complaints"
    >
      {children}
    </OrderAccess>
  );
}

/** Mantém navegação e mensagens de carregamento específicas desta área. */
export function ComplaintLayout(props) {
  return (
    <ReturnLayout backTo="/(customer)/complaints" refreshLabel="Atualizar reclamações" {...props} />
  );
}

/** Apresenta carregamento, erro e ausência de reclamações com a estrutura já existente. */
export function ComplaintFeedback(props) {
  return (
    <ReturnFeedback
      loadingText="A consultar reclamações..."
      emptyText="Ainda não tem reclamações. Pode abrir uma no detalhe de uma compra."
      {...props}
    />
  );
}

/** Bloqueia toques repetidos e conserva o formulário quando o resultado do envio é incerto. */
export function useComplaintMutation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [unknown, setUnknown] = useState(false);
  const lock = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  /** Executa só por ação do Cliente, sem repetir o POST/PATCH em falhas de rede. */
  async function run(operation, onSuccess, onBusy) {
    if (lock.current || unknown) return;
    lock.current = true;
    setBusy(true);
    onBusy?.(true);
    setError('');
    try {
      const result = await operation();
      if (active.current) onSuccess(result);
    } catch (failure) {
      if (active.current) {
        const uncertain = returnOutcomeUnknown(failure);
        setUnknown(uncertain);
        setError(
          uncertain
            ? 'Não foi possível confirmar o resultado. Consulte o estado antes de tentar novamente.'
            : returnError(failure),
        );
      }
    } finally {
      lock.current = false;
      if (active.current) setBusy(false);
      onBusy?.(false);
    }
  }
  return { busy, error, unknown, run };
}
