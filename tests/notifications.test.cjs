const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');
/** Exercita rotas privadas e destinos sem alterar notificações reais. */
function api(request = async () => ({})) {
  return load('src/features/notifications/services/notificationsApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
}
test('caixa filtra antes da paginação e marca leitura por PATCH autenticado', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
  });
  await service.getNotifications('jwt', 2, true);
  await service.markNotification('jwt', 8);
  await service.markAllNotifications('jwt');
  assert.equal(calls[0].path, '/notifications?page=2&per_page=15&read=0');
  assert.equal(calls[1].path, '/notifications/8/read');
  assert.equal(calls[1].options.method, 'PATCH');
  assert.equal(calls[2].path, '/notifications/read-all');
  assert.ok(calls.every(({ options }) => options.token === 'jwt'));
  assert.throws(() => service.markNotification('jwt', '../8'));
});
test('navegação aceita apenas ações e parâmetros internos reconhecidos', async () => {
  const service = await api();
  assert.equal(
    service.notificationTarget({
      data: { action: 'VIEW_CLIENT_REFUND', action_params: { refund_request_id: 4 } },
    }).params.id,
    4,
  );
  const reference = '12345678-1234-1234-1234-123456789abc';
  assert.equal(
    service.notificationTarget({
      data: { action: 'VIEW_ORDER_GROUP', action_params: { reference } },
    }).params.reference,
    reference,
  );
  for (const data of [
    { action: 'https://outside.test' },
    { action: 'VIEW_ORDER_GROUP', action_params: { reference: '../x' } },
    { action: 'VIEW_CLIENT_REFUND', action_params: { refund_request_id: -1 } },
  ])
    assert.equal(service.notificationTarget({ data }), null);
});
test('falha da marcação não repete automaticamente o pedido', async () => {
  let count = 0;
  const service = await api(async () => {
    count++;
    throw { status: 0 };
  });
  await assert.rejects(service.markNotification('jwt', 1));
  assert.equal(count, 1);
});

test('preferências guardam apenas uma combinação suportada e não aceitam canais inventados', async () => {
  const calls = [];
  const service = await load('src/features/notifications/services/notificationPreferencesApi.js', {
    '@/services/http/apiClient': {
      apiRequest: async (path, options) => {
        calls.push({ path, options });
      },
    },
  });
  await service.getNotificationPreferences('jwt');
  const event = { event_type: 'PAYMENT_APPROVED', channels: [{ channel: 'EMAIL' }] };
  await service.saveNotificationPreference('jwt', event, 'EMAIL', false);
  assert.equal(calls[0].path, '/notifications/preferences');
  assert.equal(calls[1].options.method, 'PUT');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    preferences: [{ event_type: 'PAYMENT_APPROVED', channel: 'EMAIL', enabled: false }],
  });
  assert.throws(() => service.saveNotificationPreference('jwt', event, 'FAKE', true));
  assert.throws(() => service.saveNotificationPreference('jwt', event, 'EMAIL', 'true'));
  assert.equal(calls.length, 2);
});

test('notificação de ocorrência abre somente a devolução identificada pela API', async () => {
  const service = await api();
  const target = service.notificationTarget({ data: { action: 'VIEW_CLIENT_RETURN', action_params: { return_request_id: '7' } } });
  assert.equal(target.pathname, '/(customer)/returns/[id]');
  assert.equal(target.params.id, 7);
  for (const id of ['../7', '7/8', 0, -1, '9007199254740992', null, undefined]) {
    assert.equal(service.notificationTarget({ data: { action: 'VIEW_CLIENT_RETURN', action_params: { return_request_id: id } } }), null);
  }
  assert.equal(service.notificationTarget({ data: { action: 'VIEW_CLIENT_RETURN', action_params: {} } }), null);
});
