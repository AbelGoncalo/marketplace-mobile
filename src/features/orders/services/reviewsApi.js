import { apiRequest } from '@/services/http/apiClient';

const resources = {
  products: 'order_item_id',
  stores: 'order_id',
  deliveries: 'transport_delivery_id',
};

/** Reúne apenas recursos que a API permite avaliar, mantendo a identidade da compra. */
export function reviewTargets(order) {
  return (order.orders || []).flatMap((store) => {
    const targets = (store.items || []).map((item) => ({
      kind: 'products',
      id: item.id,
      title: item.product?.name || 'Produto',
      review: item.review,
    }));
    targets.push({
      kind: 'stores',
      id: store.id,
      title: `Loja · ${store.store?.name || 'Loja'}`,
      review: store.store_review,
    });
    targets.push({
      kind: 'deliveries',
      id: store.delivery?.delivery_id,
      title: `Entrega · ${store.store?.name || 'Loja'}`,
      review: store.delivery?.review,
    });
    return targets.filter((target) => target.review?.can_review || target.review?.review_id);
  });
}

/** Consulta o conteúdo original para editar comentário e anonimato sem os substituir por omissões. */
export function getReviews(token) {
  return apiRequest('/client/reviews', { token });
}

/** Localiza a avaliação pela compra original, incluindo respostas recuperadas após falha de rede. */
export function findReview(reviews, target) {
  return (
    (reviews?.[target.kind] || []).find((review) => review[resources[target.kind]] === target.id) ||
    null
  );
}

/** Valida o formulário e usa POST na criação ou PUT no identificador original da avaliação. */
export function saveReview(token, target, reviewId, values) {
  if (!resources[target?.kind] || !Number.isSafeInteger(target.id) || target.id < 1)
    throw new Error('A compra a avaliar é inválida.');
  if (reviewId != null && (!Number.isSafeInteger(reviewId) || reviewId < 1))
    throw new Error('A avaliação é inválida.');
  if (!Number.isInteger(values.rating) || values.rating < 1 || values.rating > 5)
    throw new Error('Selecione uma classificação de 1 a 5 estrelas.');
  if (typeof values.comment !== 'string' || [...values.comment].length > 3000)
    throw new Error('O comentário deve ter até 3000 caracteres.');
  if (typeof values.is_anonymous !== 'boolean') throw new Error('A opção de anonimato é inválida.');
  const body = {
    rating: values.rating,
    comment: values.comment.trim() || null,
    is_anonymous: values.is_anonymous,
  };
  if (reviewId == null) body[resources[target.kind]] = target.id;
  return apiRequest(`/client/reviews/${target.kind}${reviewId == null ? '' : `/${reviewId}`}`, {
    token,
    method: reviewId == null ? 'POST' : 'PUT',
    body: JSON.stringify(body),
  });
}
