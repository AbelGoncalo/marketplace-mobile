const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Exercita o contrato real dos serviços sem tocar nas encomendas da demonstração. */
function service(file, request) {
  return load(file, { '@/services/http/apiClient': { apiRequest: request } });
}
test('entregador consulta entregas privadas paginadas e rejeita referências inválidas', async () => {
  const calls = [];
  const api = await service(
    'src/features/delivery/services/deliveryApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  await api.getDeliveries('jwt', 2);
  await api.getDelivery('jwt', 9);
  assert.equal(calls[0].path, '/delivery-person/deliveries?page=2&per_page=15');
  assert.equal(calls[1].path, '/delivery-person/deliveries/9');
  assert.ok(calls.every(({ options }) => options.token === 'jwt'));
  assert.throws(() => api.getDelivery('jwt', '../9'));
  assert.throws(() => api.getDeliveries('jwt', 0));
  assert.throws(() => api.getDelivery('jwt', '9007199254740992'));
});
test('recolha exige ação autorizada e código de seis algarismos sem enviar campos adicionais', async () => {
  const calls = [];
  const api = await service(
    'src/features/delivery/services/deliveryApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  const delivery = {
    id: 9,
    allowed_actions: ['START_PICKUP', 'CONFIRM_PICKUP', 'CONFIRM_DELIVERY'],
  };
  assert.throws(() =>
    api.pickupAction('jwt', { ...delivery, allowed_actions: [] }, 'START_PICKUP'),
  );
  assert.throws(() => api.pickupAction('jwt', delivery, 'CONFIRM_DELIVERY', '123456'));
  for (const code of ['', '12345', '1234567', '12a456', ' 123456'])
    assert.throws(() => api.pickupAction('jwt', delivery, 'CONFIRM_PICKUP', code));
  assert.equal(calls.length, 0);
  await api.pickupAction('jwt', delivery, 'START_PICKUP');
  await api.pickupAction('jwt', delivery, 'CONFIRM_PICKUP', '123456');
  assert.equal(calls[0].path, '/delivery-person/deliveries/9/start-pickup');
  assert.equal(calls[1].path, '/delivery-person/deliveries/9/confirm-pickup');
  assert.deepEqual(JSON.parse(calls[0].options.body), {});
  assert.deepEqual(JSON.parse(calls[1].options.body), { pickup_code: '123456' });
  assert.ok(calls.every(({ options }) => options.method === 'PATCH' && options.token === 'jwt'));
});
test('lojista confirma passagem e regenera código apenas com permissão e ação autorizada', async () => {
  const calls = [];
  const api = await service(
    'src/features/merchant/services/merchantOrdersApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  const order = { id: 8, allowed_actions: ['CONFIRM_HANDOVER', 'REGENERATE_PICKUP_CODE'] };
  const permissions = ['supplier-orders.fulfillment'];
  assert.throws(() => api.merchantHandover('jwt', order, 'CONFIRM_HANDOVER', []));
  assert.throws(() =>
    api.merchantHandover(
      'jwt',
      { ...order, allowed_actions: [] },
      'REGENERATE_PICKUP_CODE',
      permissions,
    ),
  );
  assert.throws(() => api.merchantHandover('jwt', order, 'CONFIRM_CUSTOMER_PICKUP', permissions));
  assert.equal(calls.length, 0);
  await api.merchantHandover('jwt', order, 'CONFIRM_HANDOVER', permissions);
  await api.merchantHandover('jwt', order, 'REGENERATE_PICKUP_CODE', permissions);
  assert.equal(calls[0].path, '/supplier/orders/8/confirm-handover');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.equal(calls[1].path, '/supplier/orders/8/pickup-code/regenerate');
  assert.equal(calls[1].options.method, 'POST');
  assert.ok(calls.every(({ options }) => options.token === 'jwt'));
});
test('lojista valida o código do Cliente apenas com permissão e ação autorizada', async () => {
  const calls = [];
  const api = await service(
    'src/features/merchant/services/merchantOrdersApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  const order = { id: 8, allowed_actions: ['CONFIRM_CUSTOMER_PICKUP'] };
  const permissions = ['supplier-orders.fulfillment'];
  assert.throws(() => api.confirmCustomerPickup('jwt', order, '123456', []));
  assert.throws(() =>
    api.confirmCustomerPickup('jwt', { ...order, allowed_actions: [] }, '123456', permissions),
  );
  for (const code of ['', '12345', '1234567', '12a456', ' 123456'])
    assert.throws(() => api.confirmCustomerPickup('jwt', order, code, permissions));
  assert.equal(calls.length, 0);
  await api.confirmCustomerPickup('jwt', order, '123456', permissions);
  assert.equal(calls[0].path, '/supplier/orders/8/confirm-customer-pickup');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body), { confirmation_code: '123456' });
  assert.equal(calls[0].options.token, 'jwt');
});
test('falhas de recolha não repetem a operação automaticamente', async () => {
  let calls = 0;
  const failure = { status: 0 };
  const api = await service('src/features/delivery/services/deliveryApi.js', async () => {
    calls++;
    throw failure;
  });
  await assert.rejects(
    api.pickupAction(
      'jwt',
      { id: 9, allowed_actions: ['CONFIRM_PICKUP'] },
      'CONFIRM_PICKUP',
      '123456',
    ),
    (error) => error === failure,
  );
  assert.equal(calls, 1);
  assert.equal(api.deliveryStatus('PICKED_UP'), 'Recolhida na loja');
  assert.equal(api.deliveryStatus('unexpected'), 'Estado em atualização');
});
test('transporte e entrega exigem ação autorizada, destinatário e código válidos', async () => {
  const calls = [];
  const api = await service(
    'src/features/delivery/services/deliveryApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  const delivery = { id: 9, allowed_actions: ['START_TRANSIT', 'CONFIRM_DELIVERY'] };
  assert.throws(() => api.deliveryAction('jwt', delivery, 'REPORT_FAILURE'));
  assert.throws(() =>
    api.deliveryAction('jwt', { ...delivery, allowed_actions: [] }, 'START_TRANSIT'),
  );
  assert.throws(() => api.deliveryAction('jwt', delivery, 'CONFIRM_DELIVERY', {}));
  assert.throws(() =>
    api.deliveryAction('jwt', delivery, 'CONFIRM_DELIVERY', {
      recipient_name: 'Cliente',
      confirmation_code: '12a456',
    }),
  );
  assert.equal(calls.length, 0);
  await api.deliveryAction('jwt', delivery, 'START_TRANSIT');
  await api.deliveryAction('jwt', delivery, 'CONFIRM_DELIVERY', {
    recipient_name: '  Bela Cliente  ',
    confirmation_code: '123456',
    ignored: 'não enviar',
  });
  assert.equal(calls[0].path, '/delivery-person/deliveries/9/start-transit');
  assert.deepEqual(JSON.parse(calls[0].options.body), {});
  assert.equal(calls[1].path, '/delivery-person/deliveries/9/confirm-delivery');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    recipient_name: 'Bela Cliente',
    confirmation_code: '123456',
  });
  assert.ok(calls.every(({ options }) => options.method === 'PATCH' && options.token === 'jwt'));
});
test('entregador comunica falha com motivo obrigatório e apenas o campo aceite', async () => {
  const calls = [];
  const api = await service(
    'src/features/delivery/services/deliveryApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  const delivery = { id: 9, allowed_actions: ['START_TRANSIT', 'REPORT_FAILURE'] };
  assert.throws(() =>
    api.reportDeliveryFailure('jwt', { ...delivery, allowed_actions: [] }, 'Cliente ausente'),
  );
  assert.throws(() => api.reportDeliveryFailure('jwt', delivery, ''));
  assert.throws(() => api.reportDeliveryFailure('jwt', delivery, '     '));
  assert.throws(() => api.reportDeliveryFailure('jwt', delivery, 'a'.repeat(2001)));
  assert.throws(() => api.deliveryAction('jwt', delivery, 'REPORT_FAILURE', {}));
  assert.equal(calls.length, 0);
  await api.reportDeliveryFailure('jwt', delivery, '  Cliente ausente no endereço  ');
  assert.equal(calls[0].path, '/delivery-person/deliveries/9/report-failure');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body), { reason: 'Cliente ausente no endereço' });
  assert.equal(calls[0].options.token, 'jwt');
});
test('devolução à loja exige ação autorizada e não envia código de entrega', async () => {
  const calls = [];
  const api = await service(
    'src/features/delivery/services/deliveryApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  const delivery = { id: 9, allowed_actions: ['CONFIRM_RETURN_TO_STORE', 'REPORT_FAILURE'] };
  assert.throws(() => api.deliveryAction('jwt', delivery, 'CONFIRM_RETURN_TO_STORE', {}));
  assert.throws(() =>
    api.deliveryAction('jwt', delivery, 'CONFIRM_RETURN_TO_STORE', {
      recipient_name: 'a'.repeat(181),
    }),
  );
  assert.throws(() =>
    api.deliveryAction('jwt', { ...delivery, allowed_actions: [] }, 'CONFIRM_RETURN_TO_STORE', {
      recipient_name: 'Dona Ana',
    }),
  );
  assert.equal(calls.length, 0);
  await api.deliveryAction('jwt', delivery, 'CONFIRM_RETURN_TO_STORE', {
    recipient_name: '  Dona Ana  ',
    confirmation_code: '123456',
  });
  assert.equal(calls[0].path, '/delivery-person/deliveries/9/confirm-return-to-store');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].options.body), { recipient_name: 'Dona Ana' });
  assert.equal(calls[0].options.token, 'jwt');
});
test('autenticação encaminha o tipo Entregador sem conceder acesso a clientes', async () => {
  const api = await load('src/features/auth/utils/accessControl.js');
  assert.equal(
    api.getPostLoginRoute({ user: { accountType: 'Entregador', roles: [] } }),
    '/(delivery)/delivery',
  );
  assert.equal(
    api.getPostLoginRoute({ user: { accountType: 'Cliente', roles: [] } }),
    '/(customer)/(tabs)/profile',
  );
});
