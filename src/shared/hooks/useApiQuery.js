import { useCallback, useEffect, useState } from 'react';

/** Ignora respostas de pedidos antigos e deriva o carregamento da consulta atual. */
export function useApiQuery(loader) {
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    Promise.resolve()
      .then(loader)
      .then(
        (data) => {
          if (active) setResult({ loader, revision, data, error: '' });
        },
        (error) => {
          if (active) setResult({ loader, revision, data: null, error: error.message });
        },
      );
    return () => {
      active = false;
    };
  }, [loader, revision]);

  const current = result?.loader === loader && result?.revision === revision;
  return {
    data: current ? result.data : null,
    error: current ? result.error : '',
    isLoading: !current,
    refresh,
  };
}
