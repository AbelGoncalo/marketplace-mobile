import { useCallback } from 'react';

import { getShoppingCenters } from '@/features/management/services/superAdminApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';

export function useShoppingCenters(token) {
  const query = useCallback(() => getShoppingCenters(token), [token]);
  const { data, error, isLoading, refresh } = useApiQuery(query);
  const centers = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return {
    centers,
    error,
    isLoading,
    loadCenters: refresh,
    total: Number(data?.total) || centers.length,
  };
}
