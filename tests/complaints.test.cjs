const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

const purchase = {
  orders: [
    { id: 10, can_open_complaint: true, items: [{ id: 20 }] },
    { id: 11, can_open_complaint: true, items: [{ id: 21 }] },
  ],
};
const values = {
  orderId: '10',
  itemId: '20',
  type: 'PRODUCT',
  subject: ' Artigo danificado ',
  description: ' A embalagem chegou danificada. ',
};

/** Simula apenas o transporte; usa as validações reais sem criar reclamações de Clientes. */
function api(request = async () => ({})) {
  return load('src/features/complaints/services/complaintsApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
}

test('reclamações usam consultas privadas paginadas e detalhe com JWT', async () => {
  const calls = [];
  const response = { data: [], last_page: 2 };
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    return response;
  });
  assert.equal(await service.getComplaints('jwt', 2), response);
  assert.equal(await service.getComplaint('jwt', '8'), response);
  assert.equal(calls[0].path, '/client/complaints?page=2&per_page=15');
  assert.equal(calls[1].path, '/client/complaints/8');
  assert.ok(calls.every(({ options }) => options.token === 'jwt' && !options.method));
});

test('criação envia só os campos oficiais da compra e remove espaços do texto', async () => {
  let call;
  const service = await api(async (path, options) => {
    call = { path, options };
  });
  await service.createComplaint('jwt', purchase, { ...values, client_id: 99, priority: 'HIGH' });
  assert.equal(call.path, '/client/complaints');
  assert.equal(call.options.method, 'POST');
  assert.equal(call.options.token, 'jwt');
  assert.deepEqual(JSON.parse(call.options.body), {
    order_id: 10,
    order_item_id: 20,
    type: 'PRODUCT',
    subject: 'Artigo danificado',
    description: 'A embalagem chegou danificada.',
  });
  await service.createComplaint('jwt', purchase, { ...values, itemId: '' });
  assert.equal(Object.hasOwn(JSON.parse(call.options.body), 'order_item_id'), false);
});

test('encomenda ausente e artigo de outra loja bloqueiam envio', async () => {
  let count = 0;
  const service = await api(async () => {
    count++;
  });
  assert.throws(() => service.createComplaint('jwt', null, values), /Selecione/);
  assert.throws(
    () => service.createComplaint('jwt', purchase, { ...values, orderId: '99' }),
    /Selecione/,
  );
  assert.throws(
    () => service.createComplaint('jwt', purchase, { ...values, itemId: '21' }),
    /não pertence/,
  );
  assert.throws(
    () => service.createComplaint('jwt', purchase, { ...values, orderId: '11' }),
    /não pertence/,
  );
  assert.equal(count, 0);
});

test('categoria, assunto e descrição respeitam os limites da API', async () => {
  let count = 0;
  const service = await api(async () => {
    count++;
  });
  assert.throws(
    () => service.createComplaint('jwt', purchase, { ...values, type: 'FAKE' }),
    /categoria/,
  );
  for (const subject of ['', '  ', 'x'.repeat(181)])
    assert.throws(
      () => service.createComplaint('jwt', purchase, { ...values, subject }),
      /assunto/,
    );
  for (const description of ['', 'curta', 'x'.repeat(5001)])
    assert.throws(
      () => service.createComplaint('jwt', purchase, { ...values, description }),
      /10 a 5000/,
    );
  assert.equal(count, 0);
  for (const type of service.complaintTypes)
    await service.createComplaint('jwt', purchase, {
      ...values,
      type: type.value,
      subject: 'x'.repeat(180),
      description: 'x'.repeat(5000),
    });
  assert.equal(count, 5);
});

test('cancelamento exige estado aberto, permissão e motivo, usando PATCH', async () => {
  let call;
  const service = await api(async (path, options) => {
    call = { path, options };
  });
  const complaint = { id: 8, status: 'OPEN', allowed_actions: ['CANCEL'] };
  for (const status of ['IN_REVIEW', 'WAITING_CUSTOMER', 'RESOLVED', 'REJECTED', 'CANCELLED'])
    assert.throws(
      () => service.cancelComplaint('jwt', { ...complaint, status }, 'Motivo válido'),
      /não permite/,
    );
  assert.throws(
    () => service.cancelComplaint('jwt', { ...complaint, allowed_actions: [] }, 'Motivo válido'),
    /não permite/,
  );
  for (const reason of ['', 'curt', 'x'.repeat(1001)])
    assert.throws(() => service.cancelComplaint('jwt', complaint, reason), /5 a 1000/);
  await service.cancelComplaint('jwt', complaint, ' Problema resolvido. ');
  assert.equal(call.path, '/client/complaints/8/cancel');
  assert.equal(call.options.method, 'PATCH');
  assert.deepEqual(JSON.parse(call.options.body), { reason: 'Problema resolvido.' });
});

test('referências inválidas não consultam a API e falhas não repetem a criação', async () => {
  let count = 0;
  const failure = { status: 0, message: 'Ligação interrompida' };
  const service = await api(async () => {
    count++;
    throw failure;
  });
  for (const id of ['../8', '', null, 0, -1, 1.5, '9007199254740992']) {
    assert.throws(() => service.getComplaint('jwt', id), /inválida/);
    assert.throws(() => service.getComplaints('jwt', id), /inválida/);
  }
  assert.equal(count, 0);
  await assert.rejects(
    service.createComplaint('jwt', purchase, values),
    (error) => error === failure,
  );
  assert.equal(count, 1);
});

test('estados são traduzidos sem confundir resolução com pagamento', async () => {
  const service = await api();
  assert.equal(service.complaintStatus('OPEN').label, 'Aberta');
  assert.equal(
    service.complaintStatus('WAITING_CUSTOMER').label,
    'A aguardar informação do cliente',
  );
  assert.equal(service.complaintStatus('RESOLVED').label, 'Resolvida');
  assert.equal(service.complaintStatus('UNKNOWN').label, 'Estado em atualização');
});

test('seleção de nova reclamação oculta apenas encomendas sem permissão oficial', async () => {
  const service = await api();
  const eligible = {
    orders: [
      { id: 1, can_open_complaint: false },
      { id: 2, can_open_complaint: true },
      { id: 3 },
      { id: 4, can_open_complaint: 'true' },
    ],
  };
  assert.deepEqual(
    Array.from(service.eligibleComplaintOrders(eligible), (order) => order.id),
    [2],
  );
  assert.equal(service.eligibleComplaintOrders(null).length, 0);
  assert.equal(eligible.orders.length, 4);
});

test('dados antigos ou encomenda reclamada não permitem um novo envio pelo formulário', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
  });
  for (const can_open_complaint of [false, undefined]) {
    assert.throws(
      () =>
        service.createComplaint(
          'jwt',
          { orders: [{ id: 10, can_open_complaint, items: [{ id: 20 }] }] },
          values,
        ),
      /não está disponível/,
    );
  }
  assert.equal(calls, 0);
});

test('repetição em curso exige o mesmo artigo e categoria, incluindo âmbito de encomenda inteira', async () => {
  const service = await api();
  const order = {
    ongoing_complaints: [
      { id: 1, order_item_id: 20, type: 'PRODUCT' },
      { id: 2, order_item_id: null, type: 'DELIVERY' },
    ],
  };
  assert.equal(service.findOngoingComplaint(order, '20', 'PRODUCT').id, 1);
  assert.equal(service.findOngoingComplaint(order, '20', 'DELIVERY'), null);
  assert.equal(service.findOngoingComplaint(order, '21', 'PRODUCT'), null);
  assert.equal(service.findOngoingComplaint(order, '', 'PRODUCT'), null);
  assert.equal(service.findOngoingComplaint(order, '', 'DELIVERY').id, 2);
  assert.equal(service.findOngoingComplaint(order, '20', ''), null);
});

test('formulário bloqueia só a combinação em curso sem impedir outros problemas da compra', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
  });
  const scoped = {
    orders: [
      {
        id: 10,
        can_open_complaint: true,
        items: [{ id: 20 }, { id: 22 }],
        ongoing_complaints: [{ id: 1, order_item_id: 20, type: 'PRODUCT' }],
      },
    ],
  };
  assert.throws(() => service.createComplaint('jwt', scoped, values), /em curso/);
  assert.equal(calls.length, 0);
  assert.equal(service.eligibleComplaintOrders(scoped).length, 1);
  await service.createComplaint('jwt', scoped, { ...values, type: 'PAYMENT' });
  await service.createComplaint('jwt', scoped, { ...values, itemId: '22' });
  await service.createComplaint('jwt', scoped, { ...values, itemId: '' });
  assert.equal(calls.length, 3);
});

test('encerrar reclamação permite nova ocorrência e não confunde âmbitos de encomendas distintas', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
  });
  const scoped = {
    orders: [
      { id: 10, can_open_complaint: true, items: [{ id: 20 }], ongoing_complaints: [] },
      {
        id: 11,
        can_open_complaint: true,
        items: [{ id: 21 }],
        ongoing_complaints: [{ id: 2, order_item_id: null, type: 'PRODUCT' }],
      },
    ],
  };
  await service.createComplaint('jwt', scoped, values);
  await service.createComplaint('jwt', scoped, { ...values, itemId: '' });
  assert.equal(calls, 2);
});
