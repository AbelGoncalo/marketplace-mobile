import { useCallback } from 'react';

import { getSuperAdminMetrics } from '@/features/management/services/superAdminApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';

export function useSuperAdminMetrics(token) {
  const query = useCallback(() => getSuperAdminMetrics(token), [token]);
  const { data, error, isLoading, refresh } = useApiQuery(query);
  return { error, isLoading, metrics: data || [], refresh };
}
