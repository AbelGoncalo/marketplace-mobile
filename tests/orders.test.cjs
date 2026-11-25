const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

const reference = '12345678-1234-4567-89ab-123456789abc';

/** Usa o serviço real com transporte simulado para verificar a identidade e os caminhos. */
function ordersApi(request) {
  return load('src/features/orders/services/ordersApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
}

/** Carrega as traduções e a apresentação sem depender de componentes visuais. */
function presentation() {
  return load('src/features/orders/utils/orderPresentation.js');
}

test('listagem envia página e JWT e preserva os metadados devolvidos', async () => {
  const calls = [];
  const page = { data: [], current_page: 2, last_page: 4, total: 60 };
  const api = await ordersApi(async (path, options) => {
    calls.push({ path, options });
    return page;
  });
  assert.equal(await api.getOrders('client-jwt', 2), page);
  assert.equal(calls[0].path, '/client/order-groups?page=2&per_page=15');
  assert.equal(calls[0].options.token, 'client-jwt');
});

test('detalhe e acompanhamento só fazem consultas autenticadas sem emitir códigos', async () => {
  const calls = [];
  const api = await ordersApi(async (path, options) => {
    calls.push({ path, options });
    return {};
  });
  await api.getOrder('jwt', reference);
  await api.getOrderTracking('jwt', reference);
  assert.deepEqual(
    calls.map((call) => call.path),
    [`/client/order-groups/${reference}`, `/client/order-groups/${reference}/tracking`],
  );
  assert.equal(
    calls.every(
      (call) => call.options.token === 'jwt' && !call.options.method && !call.options.body,
    ),
    true,
  );
});

test('referências e páginas inválidas não provocam pedidos', async () => {
  let calls = 0;
  const api = await ordersApi(async () => {
    calls += 1;
  });
  for (const value of ['', '../other', 'not-a-uuid', null]) {
    await assert.rejects(api.getOrder('jwt', value), /referência/);
  }
  for (const page of [0, -1, 1.2, '2', Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => api.getOrders('jwt', page), /página/);
  assert.equal(calls, 0);
});

test('404 não revela dados de outra conta e erros de sessão são preservados', async () => {
  const missing = await ordersApi(async () => {
    throw { status: 404 };
  });
  await assert.rejects(missing.getOrder('jwt', reference), /não foi encontrada ou não pertence/);
  const expired = { status: 401, message: 'Sessão expirada' };
  const api = await ordersApi(async () => {
    throw expired;
  });
  await assert.rejects(api.getOrderTracking('jwt', reference), (error) => error === expired);
});

test('erro de acompanhamento mantém a mensagem original para nova tentativa', async () => {
  const network = new Error('Sem ligação');
  const api = await ordersApi(async () => {
    throw network;
  });
  await assert.rejects(api.getOrderTracking('jwt', reference), (error) => error === network);
});

test('compra e pagamento usam traduções independentes e estados desconhecidos têm alternativa', async () => {
  const view = await presentation();
  assert.equal(view.orderStatus('CONFIRMED').label, 'Confirmada');
  assert.equal(view.orderStatus('PENDING', true).label, 'Pagamento pendente');
  assert.equal(view.orderStatus('APPROVED', true).label, 'Pagamento aprovado');
  assert.equal(view.orderStatus('CANCELLED').variant, 'promotion');
  assert.equal(view.orderStatus('NEW_STATE').label, 'Estado em atualização');
  assert.equal(view.orderStatus('NEW_STATE', true).label, 'Pagamento em atualização');
});

test('valores respeitam a moeda histórica e datas ausentes não geram Invalid Date', async () => {
  const view = await presentation();
  assert.match(view.orderAmount('123.45', 'AOA'), /123,45 AOA/);
  assert.match(view.orderAmount('123.45', 'EUR'), /123,45 EUR/);
  assert.equal(view.orderAmount(null), 'Valor indisponível');
  assert.equal(view.orderDate(null), 'Data indisponível');
  assert.equal(view.orderDate('invalid'), 'Data indisponível');
  assert.match(view.orderDate('2026-11-13T10:00:00Z'), /2026/);
});

test('histórico é ordenado cronologicamente sem modificar a resposta da API', async () => {
  const view = await presentation();
  const original = [
    { label: 'Entregue', occurred_at: '2026-11-13T12:00:00Z' },
    { label: 'Em trânsito', occurred_at: '2026-11-13T10:00:00Z' },
  ];
  const sorted = view.orderedTimeline(original);
  assert.equal(sorted[0].label, 'Em trânsito');
  assert.equal(original[0].label, 'Entregue');
  assert.equal(view.orderedTimeline().length, 0);
});

// Confere os contratos distintos de levantamento e entrega sem emitir códigos reais.
test('códigos usam POST autenticado e normalizam a validade com a hora do servidor', async () => {
  const calls = [];
  const code = { confirmation_code: '123456', expires_at: '2026-11-13T10:15:00Z' };
  const api = await ordersApi(async (path, options) => {
    calls.push({ path, options });
    return {
      data: path.endsWith('pickup-code') ? code : { delivery_confirmation: code },
      serverDate: 'Fri, 13 Nov 2026 10:00:00 GMT',
      receivedAt: 1000,
    };
  });
  for (const kind of ['pickup', 'delivery']) {
    const result = await api.issueOrderCode('jwt', reference, { kind, id: 7 });
    assert.equal(result.confirmation_code, '123456');
    assert.equal(result.deadline, 901000);
  }
  assert.equal(calls[0].path, `/client/order-groups/${reference}/orders/7/pickup-code`);
  assert.equal(calls[1].path, `/client/order-groups/${reference}/deliveries/7/confirmation-code`);
  assert.ok(calls.every(({ options }) => options.method === 'POST' && options.token === 'jwt'));
});

test('ações inválidas não enviam pedidos e falhas não são repetidas automaticamente', async () => {
  let calls = 0;
  const api = await ordersApi(async () => {
    calls += 1;
    throw new Error('Limite de pedidos');
  });
  for (const action of [
    null,
    { kind: 'other', id: 1 },
    { kind: 'pickup', id: '../1' },
    { kind: 'delivery', id: 0 },
  ]) {
    await assert.rejects(api.issueOrderCode('jwt', reference, action), /ação/);
  }
  assert.equal(calls, 0);
  await assert.rejects(api.issueOrderCode('jwt', reference, { kind: 'pickup', id: 1 }), /Limite/);
  assert.equal(calls, 1);
});

test('código só é oferecido para levantamento autorizado ou entrega em trânsito', async () => {
  const api = await ordersApi(async () => {});
  assert.equal(
    api.orderCodeAction({ delivery: { delivery_method: 'PICKUP' }, allowed_actions: [] }),
    null,
  );
  assert.equal(
    api.orderCodeAction({
      id: 3,
      delivery: { delivery_method: 'PICKUP' },
      allowed_actions: ['ISSUE_STORE_PICKUP_CODE'],
    }).id,
    3,
  );
  for (const status of ['ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED']) {
    assert.equal(
      api.orderCodeAction({
        delivery: { delivery_method: 'DELIVERY', delivery_id: 5, operational_status: status },
      }),
      null,
    );
  }
  assert.equal(
    api.orderCodeAction({
      delivery: { delivery_method: 'DELIVERY', delivery_id: 5, operational_status: 'IN_TRANSIT' },
    }).kind,
    'delivery',
  );
});

test('seleção para reclamar pede filtro da API e conserva paginação real', async () => {
  const calls = [];
  const service = await ordersApi(async (path, options) => {
    calls.push({ path, options });
    return { data: [], total: 0 };
  });
  await service.getOrders('jwt', 2, true);
  await service.getOrders('jwt', 2);
  assert.equal(calls[0].path, '/client/order-groups?page=2&per_page=15&complaint_eligible=1');
  assert.equal(calls[1].path, '/client/order-groups?page=2&per_page=15');
  assert.ok(calls.every(({ options }) => options.token === 'jwt' && !options.method));
});
