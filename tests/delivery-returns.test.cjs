const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Exercita o contrato real das recolhas reversas sem tocar nas encomendas da demonstração. */
function service(file, request) {
  return load(file, { '@/services/http/apiClient': { apiRequest: request } });
}
test('entregador consulta devoluções privadas paginadas e filtra por estado', async () => {
  const calls = [];
  const api = await service(
    'src/features/delivery/services/deliveryReturnsApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  await api.getReturnDeliveries('jwt', 2);
  await api.getReturnDeliveries('jwt', 1, 'AWAITING_PICKUP');
  assert.equal(calls[0].path, '/delivery-person/return-deliveries?page=2&per_page=20');
  assert.equal(
    calls[1].path,
    '/delivery-person/return-deliveries?page=1&per_page=20&status=AWAITING_PICKUP',
  );
  assert.ok(calls.every(({ options }) => options.token === 'jwt'));
  assert.throws(() => api.getReturnDeliveries('jwt', 0));
  assert.throws(() => api.getReturnDeliveries('jwt', '2/../3'));
  assert.throws(() => api.getReturnDeliveries('jwt', 1, 'ESTADO_INVENTADO'));
  assert.equal(calls.length, 2);
});
test('detalhe usa referência válida e rejeita caminhos inválidos', async () => {
  const calls = [];
  const api = await service(
    'src/features/delivery/services/deliveryReturnsApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  await api.getReturnDelivery('jwt', 4);
  assert.equal(calls[0].path, '/delivery-person/return-deliveries/4');
  assert.equal(calls[0].options.token, 'jwt');
  assert.throws(() => api.getReturnDelivery('jwt', '4/../5'));
  assert.throws(() => api.getReturnDelivery('jwt', 0));
  assert.throws(() => api.getReturnDelivery('jwt', '9007199254740992'));
  assert.equal(calls.length, 1);
});
test('recolha, transporte e entrega na loja seguem allowed_actions e enviam só o aceite', async () => {
  const calls = [];
  const api = await service(
    'src/features/delivery/services/deliveryReturnsApi.js',
    async (path, options) => calls.push({ path, options }),
  );
  const delivery = {
    id: 4,
    allowed_actions: ['CONFIRM_PICKUP', 'START_TRANSIT', 'CONFIRM_STORE_DELIVERY'],
  };
  assert.throws(() =>
    api.returnDeliveryAction('jwt', { ...delivery, allowed_actions: [] }, 'START_TRANSIT'),
  );
  assert.throws(() => api.returnDeliveryAction('jwt', delivery, 'REPORT_FAILURE'));
  for (const code of ['', '12345', '1234567', '12a456', ' 123456'])
    assert.throws(() => api.returnDeliveryAction('jwt', delivery, 'CONFIRM_PICKUP', code));
  assert.equal(calls.length, 0);
  await api.returnDeliveryAction('jwt', delivery, 'CONFIRM_PICKUP', '123456');
  await api.returnDeliveryAction('jwt', delivery, 'START_TRANSIT');
  await api.returnDeliveryAction('jwt', delivery, 'CONFIRM_STORE_DELIVERY', '654321');
  assert.equal(calls[0].path, '/delivery-person/return-deliveries/4/confirm-pickup');
  assert.deepEqual(JSON.parse(calls[0].options.body), { confirmation_code: '123456' });
  assert.equal(calls[1].path, '/delivery-person/return-deliveries/4/start-transit');
  assert.deepEqual(JSON.parse(calls[1].options.body), {});
  assert.equal(calls[2].path, '/delivery-person/return-deliveries/4/confirm-store-delivery');
  assert.deepEqual(JSON.parse(calls[2].options.body), { confirmation_code: '654321' });
  assert.ok(calls.every(({ options }) => options.method === 'PATCH' && options.token === 'jwt'));
});
test('falha de rede não repete a transição e os estados mantêm rótulos oficiais', async () => {
  let calls = 0;
  const failure = { status: 0 };
  const api = await service('src/features/delivery/services/deliveryReturnsApi.js', async () => {
    calls++;
    throw failure;
  });
  await assert.rejects(
    api.returnDeliveryAction('jwt', { id: 4, allowed_actions: ['START_TRANSIT'] }, 'START_TRANSIT'),
    (error) => error === failure,
  );
  assert.equal(calls, 1);
  assert.equal(api.returnDeliveryStatus('AWAITING_PICKUP'), 'A aguardar recolha');
  assert.equal(api.returnDeliveryStatus('PICKED_UP'), 'Recolhida');
  assert.equal(api.returnDeliveryStatus('IN_TRANSIT'), 'A caminho da loja');
  assert.equal(api.returnDeliveryStatus('DELIVERED'), 'Entregue na loja');
  assert.equal(api.returnDeliveryStatus('unexpected'), 'Estado em atualização');
});

test('recolha retirada da conta apresenta indisponibilidade sem expor a mensagem crua do 404', async () => {
  const calls = [];
  const api = await service('src/features/delivery/services/deliveryReturnsApi.js', async (path, options) => {
    calls.push({ path, options });
    throw { status: 404, message: 'Recurso solicitado não foi encontrado' };
  });
  assert.equal(await api.getReturnDelivery('jwt', 4), null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/delivery-person/return-deliveries/4');
  assert.equal(calls[0].options.token, 'jwt');
});
test('indisponibilidade não esconde falhas de rede, sessão, permissão ou servidor', async () => {
  for (const status of [0, 401, 403, 422, 500]) {
    let calls = 0;
    const failure = { status, message: 'Falha original' };
    const api = await service('src/features/delivery/services/deliveryReturnsApi.js', async () => { calls++; throw failure; });
    await assert.rejects(api.getReturnDelivery('jwt', 4), (error) => error === failure);
    assert.equal(calls, 1);
  }
});
test('nova atribuição permite consultar novamente a mesma recolha sem memorizar o 404', async () => {
  let calls = 0;
  const delivery = { id: 4, status: 'AWAITING_PICKUP', allowed_actions: ['CONFIRM_PICKUP'] };
  const api = await service('src/features/delivery/services/deliveryReturnsApi.js', async () => { calls++; if (calls === 1) throw { status: 404 }; return delivery; });
  assert.equal(await api.getReturnDelivery('jwt', 4), null);
  assert.equal(await api.getReturnDelivery('jwt', 4), delivery);
  assert.equal(calls, 2);
});
