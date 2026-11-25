const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');
/** Usa serviços reais com transporte simulado, sem preparar encomendas de apresentação. */
function api(request) {
  return load('src/features/merchant/services/merchantOrdersApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
}
test('lojista consulta a própria lista paginada e o detalhe com JWT', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
  });
  await service.getMerchantOrders('jwt', 2, 'PREPARING');
  await service.getMerchantOrder('jwt', 9);
  assert.equal(calls[0].path, '/supplier/orders?page=2&per_page=15&fulfillment_status=PREPARING');
  assert.equal(calls[1].path, '/supplier/orders/9');
  assert.ok(calls.every(({ options }) => options.token === 'jwt'));
  assert.throws(() => service.getMerchantOrders('jwt', 0));
  assert.throws(() => service.getMerchantOrders('jwt', 1, 'FAKE'));
  assert.throws(() => service.getMerchantOrder('jwt', '../9'));
});
test('transições exigem permissão e ação explícita sem aceitar operações da fase seguinte', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
  });
  const order = {
    id: 9,
    allowed_actions: ['START_PREPARATION', 'MARK_READY_FOR_PICKUP', 'CONFIRM_HANDOVER'],
  };
  assert.throws(() => service.prepareMerchantOrder('jwt', order, 'START_PREPARATION', []));
  assert.throws(() =>
    service.prepareMerchantOrder('jwt', order, 'CONFIRM_HANDOVER', ['supplier-orders.fulfillment']),
  );
  assert.throws(() =>
    service.prepareMerchantOrder('jwt', { ...order, allowed_actions: [] }, 'START_PREPARATION', [
      'supplier-orders.fulfillment',
    ]),
  );
  assert.equal(calls.length, 0);
  await service.prepareMerchantOrder('jwt', order, 'START_PREPARATION', [
    'supplier-orders.fulfillment',
  ]);
  await service.prepareMerchantOrder('jwt', order, 'MARK_READY_FOR_PICKUP', [
    'supplier-orders.fulfillment',
  ]);
  assert.equal(calls[0].path, '/supplier/orders/9/start-preparation');
  assert.equal(calls[1].path, '/supplier/orders/9/ready-for-pickup');
  assert.ok(calls.every(({ options }) => options.method === 'PATCH' && options.token === 'jwt'));
});
test('falhas de preparação não são repetidas e estados desconhecidos não inventam progresso', async () => {
  let calls = 0;
  const failure = { status: 0 };
  const service = await api(async () => {
    calls++;
    throw failure;
  });
  await assert.rejects(
    service.prepareMerchantOrder(
      'jwt',
      { id: 9, allowed_actions: ['START_PREPARATION'] },
      'START_PREPARATION',
      ['supplier-orders.fulfillment'],
    ),
    (error) => error === failure,
  );
  assert.equal(calls, 1);
  assert.equal(service.merchantOrderStatus('FAKE'), 'Estado em atualização');
});
