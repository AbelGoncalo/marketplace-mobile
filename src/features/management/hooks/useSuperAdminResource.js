import { useCallback } from 'react';

import { useApiQuery } from '@/shared/hooks/useApiQuery';

export function useSuperAdminResource(token, loader) {
  const query = useCallback(() => loader(token), [loader, token]);
  const { data, error, isLoading, refresh } = useApiQuery(query);
  const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  return { items, error, isLoading, load: refresh, total: Number(data?.total) || items.length };
}
