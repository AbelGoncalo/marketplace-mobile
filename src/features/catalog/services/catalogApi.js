import { apiRequest } from '@/services/http/apiClient';

/** Obtém as secções públicas da Home sem exigir uma sessão. */
export function getHomeContent() {
  return apiRequest('/home');
}

/** Carrega apenas as categorias ativas disponibilizadas ao público. */
export function getCatalogCategories() {
  return apiRequest('/auxiliary/product-categories');
}

/** Serializa os filtros no formato esperado pela validação do Laravel. */
export function buildProductsPath({
  search = '',
  categoryId = '',
  promotion = false,
  sort = 'newest',
  page = 1,
} = {}) {
  const params = new URLSearchParams({ per_page: '20', page: String(page), sort });
  if (search.trim()) params.set('search', search.trim());
  if (categoryId) params.set('filter[category_id]', String(categoryId));
  if (promotion) params.set('filter[has_promotion]', '1');
  return `/products?${params.toString()}`;
}

/** Consulta uma página; a pesquisa e a ordenação são executadas no servidor. */
export function getCatalogProducts(filters) {
  return apiRequest(buildProductsPath(filters));
}

/** Rejeita identificadores inválidos antes de consultar o detalhe público. */
export async function getCatalogProduct(productId) {
  const id = Number(productId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error('O identificador do produto é inválido.');
  }
  try {
    return await apiRequest(`/products/${id}`);
  } catch (error) {
    if (error.status === 404) {
      throw new Error('Este produto já não está disponível.');
    }
    throw error;
  }
}
