import { apiRequest } from '@/services/http/apiClient';

function resourceTotal(data) {
  if (Number.isFinite(Number(data?.total))) return Number(data.total);
  if (Array.isArray(data?.data)) return data.data.length;
  if (Array.isArray(data)) return data.length;
  return 0;
}

/** Consulta recursos independentes em paralelo para reduzir o tempo do dashboard. */
export async function getSuperAdminMetrics(token) {
  const [centers, stores, merchants, products] = await Promise.all([
    apiRequest('/shopping-centers/manage', { token }),
    apiRequest('/stores/manage', { token }),
    apiRequest('/merchants', { token }),
    apiRequest('/products', { token }),
  ]);

  return [
    { label: 'Centros', value: resourceTotal(centers), icon: 'business-outline' },
    { label: 'Lojas', value: resourceTotal(stores), icon: 'storefront-outline' },
    { label: 'Lojistas', value: resourceTotal(merchants), icon: 'people-outline' },
    { label: 'Produtos', value: resourceTotal(products), icon: 'cube-outline' },
  ];
}

/** Obtém a primeira página administrativa de centros comerciais. */
export function getShoppingCenters(token) {
  return apiRequest('/shopping-centers/manage', { token });
}

/** Listagens globais usadas pelo Super Admin mobile apenas para acompanhamento. */
export function getStores(token) {
  return apiRequest('/stores/manage', { token });
}

export function getMerchants(token) {
  return apiRequest('/merchants', { token });
}

export function getProducts(token) {
  return apiRequest('/products', { token });
}

/** Obtém os indicadores e dados operacionais de um centro específico. */
export function getShoppingCenterDashboard(token, centerId) {
  return apiRequest(`/shopping-centers/${centerId}/dashboard`, { token });
}
