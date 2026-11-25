import { apiRequest } from '@/services/http/apiClient';
/** Valida referências antes de construir caminhos privados. */
function id(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)))
    throw new Error('Referência inválida.');
  return Number(value);
}
/** Consulta a lista paginada da conta, sem misturar favoritos de dispositivos diferentes. */
export function getFavorites(token, page = 1) {
  return apiRequest(`/client/favorites?page=${id(page)}&per_page=15`, { token });
}
/** Consulta o coração sem descarregar toda a lista. */
export function getFavorite(token, product) {
  return apiRequest(`/client/favorites/${id(product)}`, { token });
}
/** Envia o estado pretendido de forma explícita, sem repetir automaticamente falhas de rede. */
export function setFavorite(token, product, saved) {
  if (typeof saved !== 'boolean') throw new Error('Estado inválido.');
  return apiRequest(`/client/favorites/${id(product)}`, {
    token,
    method: saved ? 'PUT' : 'DELETE',
  });
}
