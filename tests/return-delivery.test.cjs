const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Usa o validador real e um transporte simulado, sem alterar devoluções existentes. */
async function api(transport) {
  const returns = await load('src/features/returns/services/returnsApi.js', {
    '@/services/http/apiClient': { apiRequest: transport },
    '@/features/returns/services/attachmentFiles': { attachmentFormData() {} },
  });
  return load('src/features/returns/services/returnDeliveryApi.js', {
    '@/services/http/apiClient': { apiRequest: transport },
    '@/features/returns/services/returnsApi': returns,
  });
}
const request = { id: 7, status: 'AWAITING_RETURN', allowed_actions: ['CHOOSE_DELIVERY_METHOD'] };

test('modalidades usam a rota privada, sem morada na entrega presencial', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
  });
  await service.chooseReturnDelivery('jwt', request, null, 'STORE_DROPOFF', 99);
  await service.chooseReturnDelivery('jwt', request, null, 'CARRIER_PICKUP', '8');
  assert.equal(calls[0].path, '/client/returns/7/delivery');
  assert.equal(calls[0].options.token, 'jwt');
  assert.equal(calls[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].options.body), { method: 'STORE_DROPOFF' });
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    method: 'CARRIER_PICKUP',
    pickup_address_id: 8,
  });
});

test('estado, ações, modalidade e morada inválidos bloqueiam a mutação', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
  });
  assert.throws(() =>
    service.chooseReturnDelivery('jwt', { ...request, status: 'REQUESTED' }, null, 'STORE_DROPOFF'),
  );
  assert.throws(() =>
    service.chooseReturnDelivery('jwt', { ...request, allowed_actions: [] }, null, 'STORE_DROPOFF'),
  );
  assert.throws(() => service.chooseReturnDelivery('jwt', request, null, 'OTHER'));
  assert.throws(() => service.chooseReturnDelivery('jwt', request, null, 'CARRIER_PICKUP', '../8'));
  assert.equal(calls, 0);
  await service.chooseReturnDelivery(
    'jwt',
    { ...request, allowed_actions: [] },
    { allowed_actions: ['SELECT_RETURN_METHOD'] },
    'STORE_DROPOFF',
  );
  assert.equal(calls, 1);
});

test('códigos respeitam a ação e compensam um relógio do servidor atrasado', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    return {
      data: { confirmation_code: '123456', expires_at: '2026-11-14T10:05:00Z' },
      serverDate: 'Sat, 14 Nov 2026 10:00:00 GMT',
      receivedAt: Date.parse('2026-11-14T11:00:00Z'),
    };
  });
  const delivery = { allowed_actions: ['ISSUE_DROPOFF_CODE'] };
  await assert.rejects(service.issueReturnDeliveryCode('jwt', request, delivery, 'pickup'));
  await assert.rejects(
    service.issueReturnDeliveryCode('jwt', { ...request, status: 'RECEIVED' }, delivery, 'dropoff'),
  );
  assert.equal(calls.length, 0);
  const code = await service.issueReturnDeliveryCode('jwt', request, delivery, 'dropoff');
  assert.equal(code.deadline, Date.parse('2026-11-14T11:05:00Z'));
  assert.equal(calls[0].path, '/client/returns/7/dropoff-code');
  assert.equal(calls[0].options.includeResponseMetadata, true);
});

test('falhas não repetem operações e códigos incompletos não são apresentados', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
    throw { status: 0 };
  });
  await assert.rejects(service.chooseReturnDelivery('jwt', request, null, 'STORE_DROPOFF'));
  assert.equal(calls, 1);
  const malformed = await api(async () => ({ data: {} }));
  await assert.rejects(
    malformed.issueReturnDeliveryCode(
      'jwt',
      request,
      { allowed_actions: ['ISSUE_PICKUP_CODE'] },
      'pickup',
    ),
    /confirmar/,
  );
});

test('consulta logística valida o identificador e traduz a entrega sem prometer reembolso', async () => {
  let path;
  const service = await api(async (value) => {
    path = value;
  });
  assert.throws(() => service.getReturnDelivery('jwt', '../7'));
  await service.getReturnDelivery('jwt', 7);
  assert.equal(path, '/client/returns/7/delivery');
  assert.equal(service.returnDeliveryStatus('DELIVERED'), 'Entregue à loja');
  assert.equal(service.returnDeliveryStatus('UNKNOWN'), 'Estado em atualização');
});
