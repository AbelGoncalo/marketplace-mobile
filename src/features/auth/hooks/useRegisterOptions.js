import { useCallback } from 'react';

import { getMunicipalities, getRegisterOptions } from '@/features/auth/services/authApi';
import { useApiQuery } from '@/shared/hooks/useApiQuery';

const toSelectOptions = (items = []) =>
  items.map((item) => ({ label: item.name, value: String(item.id) }));

export function useRegisterOptions(provinceId) {
  const registration = useApiQuery(getRegisterOptions);
  const loadMunicipalities = useCallback(
    () => (provinceId ? getMunicipalities(provinceId) : []),
    [provinceId],
  );
  const municipalities = useApiQuery(loadMunicipalities);
  const data = registration.data;
  const options = data
    ? {
        accountTypes: data.account_types.map((item) => ({
          label: item.label,
          value: item.key,
          kind: item.account_type,
          userTypeId: item.user_type_id,
        })),
        entityTypes: toSelectOptions(data.entity_types),
        genders: toSelectOptions(data.genders),
        provinces: toSelectOptions(data.provinces),
      }
    : null;

  return {
    error: registration.error || municipalities.error,
    isLoading: registration.isLoading,
    isLoadingMunicipalities: Boolean(provinceId) && municipalities.isLoading,
    loadOptions: registration.refresh,
    municipalities: toSelectOptions(municipalities.data || []),
    options,
  };
}
