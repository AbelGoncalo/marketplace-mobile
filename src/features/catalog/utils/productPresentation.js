import { env } from '@/config/env';

/** Formata valores monetários da API em kwanzas, preservando preços indisponíveis. */
export function formatPrice(value) {
  if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
    return 'Preço indisponível';
  }
  return `${new Intl.NumberFormat('pt-AO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value))} AOA`;
}

/** Usa uma promoção apenas quando é positiva e inferior ao preço normal. */
export function productPricing(normal, promotional) {
  const hasPromotion = Number(promotional) > 0 && Number(promotional) < Number(normal);
  return { price: hasPromotion ? promotional : normal, oldPrice: hasPromotion ? normal : null };
}

/** Resolve imagens HTTP e caminhos do disco público Laravel sem aceitar outros esquemas. */
export function productImageUrl(path) {
  if (typeof path !== 'string' || !path.trim()) return null;
  const clean = path.trim();
  if (/^https?:\/\//i.test(clean)) return clean;
  if (/^[a-z][a-z\d+.-]*:/i.test(clean) || clean.startsWith('//')) return null;
  const base = env.apiUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
  const relative = clean.replace(/^\//, '');
  return `${base}/${relative.startsWith('storage/') ? relative : `storage/${relative}`}`;
}

/** Extrai um parâmetro escalar de deep links que possam conter valores repetidos. */
export function routeValue(value) {
  return typeof value === 'string' ? value : Array.isArray(value) ? value[0] || '' : '';
}
