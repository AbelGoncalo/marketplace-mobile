import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { getComplaint } from '@/features/complaints/services/complaintsApi';

/** Atualiza o estado com o ecrã ativo sem desmontar o rascunho em cada consulta periódica. */
export function useComplaintDetail(token, id, busy) {
  const [result, setResult] = useState({ data: null, error: '', verified: false });
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(false);
  const running = useRef(false);
  const blocked = useRef(busy);
  const generation = useRef(0);
  useEffect(() => {
    blocked.current = busy;
  }, [busy]);

  /** Uma falha de consulta bloqueia a escrita até confirmar novamente as permissões. */
  const refresh = useCallback(
    async (force = false) => {
      if (
        !active.current ||
        running.current ||
        (blocked.current && force !== true) ||
        AppState.currentState !== 'active'
      )
        return;
      running.current = true;
      const current = generation.current;
      setRefreshing(true);
      try {
        const data = await getComplaint(token, id);
        if (active.current && current === generation.current)
          setResult({ data, error: '', verified: true });
      } catch (failure) {
        if (active.current && current === generation.current)
          setResult((previous) => ({
            ...previous,
            error: failure.message || 'Não foi possível atualizar a reclamação.',
            verified: false,
          }));
      } finally {
        running.current = false;
        if (active.current && current === generation.current) setRefreshing(false);
      }
    },
    [token, id],
  );

  // Consulta ao entrar, ao regressar do segundo plano e a cada 15 segundos; pára ao sair do ecrã.
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      refresh();
      const timer = setInterval(refresh, 15000);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
      });
      return () => {
        active.current = false;
        generation.current += 1;
        clearInterval(timer);
        subscription.remove();
      };
    }, [refresh]),
  );

  return {
    data: result.data,
    error: result.error,
    verified: result.verified,
    isLoading: !result.data && !result.error,
    isRefreshing: refreshing,
    refresh,
  };
}
