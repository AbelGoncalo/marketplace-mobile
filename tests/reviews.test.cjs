const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Injeta apenas o transporte para verificar os contratos reais das avaliações. */
function api(request = async () => ({})) {
  return load('src/features/orders/services/reviewsApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
}
const values = { rating: 4, comment: ' Bom serviço. ', is_anonymous: true };

test('criação de cada avaliação usa identidade da compra e JWT', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    return { id: 9 };
  });
  for (const [kind, field] of [
    ['products', 'order_item_id'],
    ['stores', 'order_id'],
    ['deliveries', 'transport_delivery_id'],
  ]) {
    const result = await service.saveReview('jwt', { kind, id: 7 }, null, values);
    assert.equal(result.id, 9);
    const call = calls.at(-1);
    assert.equal(call.path, `/client/reviews/${kind}`);
    assert.equal(call.options.method, 'POST');
    assert.equal(call.options.token, 'jwt');
    assert.deepEqual(JSON.parse(call.options.body), {
      rating: 4,
      comment: 'Bom serviço.',
      is_anonymous: true,
      [field]: 7,
    });
  }
});

test('edição usa PUT no identificador existente e preserva anonimato e comentário vazio', async () => {
  let call;
  const service = await api(async (path, options) => {
    call = { path, options };
  });
  await service.saveReview('jwt', { kind: 'products', id: 7 }, 19, {
    ...values,
    comment: '',
    is_anonymous: false,
  });
  assert.equal(call.path, '/client/reviews/products/19');
  assert.equal(call.options.method, 'PUT');
  assert.deepEqual(JSON.parse(call.options.body), {
    rating: 4,
    comment: null,
    is_anonymous: false,
  });
});

test('validação impede classificações e identidades inválidas antes da rede', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
  });
  for (const rating of [0, 6, 1.2, '5', null])
    assert.throws(
      () => service.saveReview('jwt', { kind: 'stores', id: 1 }, null, { ...values, rating }),
      /classificação/,
    );
  for (const target of [
    { kind: '../products', id: 1 },
    { kind: 'stores', id: 0 },
    { kind: 'products', id: '1' },
  ])
    assert.throws(() => service.saveReview('jwt', target, null, values), /compra/);
  assert.throws(
    () => service.saveReview('jwt', { kind: 'stores', id: 1 }, -1, values),
    /avaliação/,
  );
  assert.throws(
    () =>
      service.saveReview('jwt', { kind: 'stores', id: 1 }, null, {
        ...values,
        comment: 'x'.repeat(3001),
      }),
    /3000/,
  );
  assert.throws(
    () =>
      service.saveReview('jwt', { kind: 'stores', id: 1 }, null, {
        ...values,
        is_anonymous: 'true',
      }),
    /anonimato/,
  );
  assert.equal(calls, 0);
});

test('alvos respeitam elegibilidade da API e não oferecem entrega para levantamento', async () => {
  const service = await api();
  const targets = service.reviewTargets({
    orders: [
      {
        id: 1,
        store: { name: 'Loja' },
        items: [
          { id: 3, review: { can_review: true } },
          { id: 4, review: { can_review: false } },
        ],
        store_review: { can_review: true },
        delivery: { delivery_method: 'PICKUP', review: { can_review: false } },
      },
    ],
  });
  assert.deepEqual(
    Array.from(targets, ({ kind, id }) => `${kind}-${id}`),
    ['products-3', 'stores-1'],
  );
  assert.equal(service.reviewTargets({ orders: [] }).length, 0);
});

test('recupera comentário e anonimato por identidade da compra, sem confundir o produto com outro item', async () => {
  const service = await api();
  const review = { id: 6, order_item_id: 7, comment: 'Original', is_anonymous: true };
  assert.equal(service.findReview({ products: [review] }, { kind: 'products', id: 7 }), review);
  assert.equal(service.findReview({ products: [review] }, { kind: 'products', id: 8 }), null);
});

test('consulta autenticada recupera avaliações e falhas de envio não são repetidas automaticamente', async () => {
  const calls = [];
  const error = { status: 409, message: 'Já avaliado' };
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    if (options.method) throw error;
    return { products: [] };
  });
  await service.getReviews('jwt');
  assert.equal(calls[0].path, '/client/reviews');
  assert.equal(calls[0].options.token, 'jwt');
  await assert.rejects(
    service.saveReview('jwt', { kind: 'products', id: 1 }, null, values),
    (failure) => failure === error,
  );
  assert.equal(calls.length, 2);
});
