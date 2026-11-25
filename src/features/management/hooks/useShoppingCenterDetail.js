import { useCallback } from 'react';

import { getShoppingCenterDashboard } from '@/features/management/services/superAdminApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';

export function useShoppingCenterDetail(token, centerId) {
  const query = useCallback(() => {
    const numericId = Number(centerId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new Error('O identificador do centro comercial é inválido.');
    }
    return getShoppingCenterDashboard(token, numericId);
  }, [centerId, token]);
  const { data, error, isLoading, refresh } = useApiQuery(query);
  return { dashboard: data, error, isLoading, loadDashboard: refresh };
}
