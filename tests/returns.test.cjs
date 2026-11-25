const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

const item = { order_id: 8, order_item_id: 21, can_request_return: true, returnable_quantity: 2 };
const values = { quantity: '1', reason: 'DEFECTIVE', description: ' O produto não liga. ' };

/** Carrega os serviços reais com transporte simulado, sem criar pedidos numa conta real. */
async function api(request = async () => ({})) {
  const files = await load('src/features/returns/services/attachmentFiles.js', {
    'expo-file-system': {
      File: class {
        exists = true;
        async bytes() {
          return new Uint8Array([1]);
        }
      },
    },
  });
  return load('src/features/returns/services/returnsApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
    '@/features/returns/services/attachmentFiles': files,
  });
}

test('devoluções consultam a página oficial de pedidos e produtos elegíveis com JWT', async () => {
  const calls = [];
  const page = { data: [], last_page: 3 };
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    return page;
  });
  assert.equal(await service.getReturns('jwt', 2), page);
  assert.equal(await service.getEligibleReturnItems('jwt', 3), page);
  assert.equal(calls[0].path, '/client/returns?page=2&per_page=15');
  assert.equal(calls[1].path, '/client/returns/eligible-items?page=3&per_page=15');
  assert.ok(calls.every(({ options }) => options.token === 'jwt' && !options.method));
});

test('pedido JSON conserva identidade e quantidade sem calcular preços nem anexos', async () => {
  let call;
  const response = { id: 12, status: 'REQUESTED' };
  const service = await api(async (path, options) => {
    call = { path, options };
    return response;
  });
  assert.equal(await service.createReturn('jwt', item, values), response);
  assert.equal(call.path, '/client/returns');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.token, 'jwt');
  assert.deepEqual(JSON.parse(call.options.body), {
    order_id: 8,
    order_item_id: 21,
    quantity: 1,
    reason: 'DEFECTIVE',
    description: 'O produto não liga.',
  });
});

test('produtos inelegíveis e quantidades inválidas não provocam mutações', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
  });
  assert.throws(
    () => service.createReturn('jwt', { ...item, can_request_return: false }, values),
    /disponível/,
  );
  for (const quantity of ['0', '-1', '1.5', '2e0', '', 0, 3, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => service.createReturn('jwt', item, { ...values, quantity }), /quantidade/);
  }
  assert.throws(() => service.createReturn('jwt', item, { ...values, reason: 'FAKE' }), /motivo/);
  for (const description of ['', '  pequeno ', 'x'.repeat(5001)]) {
    assert.throws(() => service.createReturn('jwt', item, { ...values, description }), /10 a 5000/);
  }
  assert.equal(calls, 0);
});

test('cancelamento usa permissão explícita, motivo e PATCH no pedido original', async () => {
  let call;
  const service = await api(async (path, options) => {
    call = { path, options };
  });
  await service.cancelReturn(
    'jwt',
    { id: 4, allowed_actions: ['CANCEL'] },
    ' Resolvi o problema. ',
  );
  assert.equal(call.path, '/client/returns/4/cancel');
  assert.equal(call.options.token, 'jwt');
  assert.equal(call.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(call.options.body), { reason: 'Resolvi o problema.' });
  assert.throws(
    () => service.cancelReturn('jwt', { id: 4, allowed_actions: [] }, 'Motivo válido'),
    /permite cancelamento/,
  );
  assert.throws(
    () => service.cancelReturn('jwt', { id: 4, allowed_actions: ['CANCEL'] }, 'curt'),
    /5 a 1000/,
  );
});

test('identificadores e páginas inválidos não enviam consultas', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
  });
  for (const id of ['../4', '', '4.0', null, -1, '9007199254740992'])
    assert.throws(() => service.getReturn('jwt', id), /identificador/);
  for (const page of [0, -1, 1.5])
    assert.throws(() => service.getReturns('jwt', page), /identificador/);
  await service.getReturn('jwt', '4');
  assert.equal(calls, 1);
});

test('uma falha de criação não é repetida e respostas ambíguas exigem consulta', async () => {
  let calls = 0;
  const failure = { status: 0, message: 'Sem ligação' };
  const service = await api(async () => {
    calls++;
    throw failure;
  });
  await assert.rejects(service.createReturn('jwt', item, values), (error) => error === failure);
  assert.equal(calls, 1);
  for (const status of [0, 500, 503]) assert.equal(service.returnOutcomeUnknown({ status }), true);
  for (const status of [401, 404, 409, 422, 429])
    assert.equal(service.returnOutcomeUnknown({ status }), false);
});

test('validação devolvida pela API e falhas de sessão são preservadas', async () => {
  const service = await api(async () => {
    throw { status: 401 };
  });
  await assert.rejects(service.getReturn('jwt', 1), (error) => error.status === 401);
  assert.equal(
    service.returnError({
      message: 'Genérica',
      errors: { quantity: ['Quantidade indisponível.'] },
    }),
    'Quantidade indisponível.',
  );
});

test('estados de devolução são traduzidos sem prometer reembolso', async () => {
  const service = await load('src/features/returns/services/returnPresentation.js');
  assert.equal(service.returnStatus('REQUESTED').label, 'Pedido enviado');
  assert.equal(service.returnStatus('ACCEPTED').label, 'Devolução aceite');
  assert.equal(service.returnStatus('UNKNOWN').label, 'Estado em atualização');
});
