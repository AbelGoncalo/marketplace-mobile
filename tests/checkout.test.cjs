const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Carrega as regras de coordenação sem depender de React nem de uma API em execução. */
function flowModule() {
  return load('src/features/checkout/services/checkoutFlow.js');
}

/** Representa uma cotação válida com chaves estáveis para verificar repetições. */
function attempt() {
  return {
    previewPayload: { address_id: 1, deliveries: [], idempotency_key: 'preview-key-123456' },
    confirmKey: 'confirm-key-123456',
    preview: {
      preview_token: 'uuid-preview',
      expires_at: new Date(Date.now() + 60000).toISOString(),
    },
    confirmStarted: false,
  };
}

test('checkout exige uma modalidade para cada loja e preserva a tarifa da API', async () => {
  const api = await flowModule();
  const stores = [
    {
      store: { id: 4 },
      options: [{ delivery_method: 'PICKUP', service_type: null, carrier_delivery_rate_id: null }],
    },
    {
      store: { id: 7 },
      options: [
        { delivery_method: 'DELIVERY', service_type: 'STANDARD', carrier_delivery_rate_id: 19 },
      ],
    },
  ];
  assert.throws(() => api.deliverySelections(stores, { 4: '0' }), /todas as lojas/);
  assert.throws(() => api.deliverySelections([], {}), /vazio/);
  const selections = api.deliverySelections(stores, { 4: '0', 7: '0' });
  assert.equal(selections[1].carrier_delivery_rate_id, 19);
  assert.equal(selections[0].delivery_method, 'PICKUP');
});

test('validade deixa datas ilegíveis para a API e reconhece a fronteira exata da expiração', async () => {
  const api = await flowModule();
  assert.equal(api.previewExpired({ expires_at: 'invalid' }), false);
  assert.equal(
    api.previewExpired({ expires_at: '2026-01-01T00:00:00Z' }, Date.parse('2026-01-01T00:00:00Z')),
    true,
  );
  assert.equal(api.previewExpired(attempt().preview), false);
});

test('resumo é persistido antes do transporte e conserva as chaves depois de uma falha', async () => {
  const api = await flowModule();
  const saved = [];
  const payloads = [];
  let fail = true;
  const flow = api.createCheckoutFlow({
    save: async (value) => saved.push(value),
    preview: async (payload) => {
      assert.ok(saved.length);
      payloads.push(payload);
      if (fail) throw new Error('Sem rede');
      return attempt().preview;
    },
  });
  const initial = attempt();
  await assert.rejects(flow.review(initial), /Sem rede/);
  fail = false;
  await flow.review(saved[0]);
  assert.equal(payloads[0].idempotency_key, payloads[1].idempotency_key);
  assert.equal(saved.at(-1).confirmKey, initial.confirmKey);
});

test('confirmação com resposta perdida reutiliza o mesmo corpo após recuperar a persistência', async () => {
  const api = await flowModule();
  let stored;
  const payloads = [];
  let lost = true;
  const flow = api.createCheckoutFlow({
    save: async (value) => {
      stored = value;
    },
    confirm: async (payload) => {
      assert.equal(stored.confirmStarted, true);
      payloads.push(payload);
      if (lost) throw new Error('Timeout');
      return { reference: 'same-order', payment_status: 'PENDING' };
    },
  });
  await assert.rejects(flow.confirm(attempt()), /Timeout/);
  lost = false;
  // Mesmo que a cotação expire entretanto, retomar permite à API recuperar a compra existente.
  stored.preview.expires_at = '2000-01-01T00:00:00Z';
  const result = await flow.confirm(stored);
  assert.deepEqual(payloads[0], payloads[1]);
  assert.equal(result.receipt.reference, 'same-order');
  assert.equal(payloads[0].payment_method, 'REFERENCE');
});

test('resumo expirado não inicia nova confirmação nem reserva stock', async () => {
  const api = await flowModule();
  let sent = false;
  const flow = api.createCheckoutFlow({
    save: async () => {
      sent = true;
    },
    confirm: async () => {
      sent = true;
    },
  });
  const initial = attempt();
  initial.preview.expires_at = '2000-01-01T00:00:00Z';
  await assert.rejects(flow.confirm(initial), /expirou/);
  assert.equal(sent, false);
});

test('falha ao guardar a tentativa impede qualquer confirmação comercial', async () => {
  const api = await flowModule();
  let sent = false;
  const flow = api.createCheckoutFlow({
    save: async () => {
      throw new Error('Armazenamento indisponível');
    },
    confirm: async () => {
      sent = true;
    },
  });
  await assert.rejects(flow.confirm(attempt()), /Armazenamento/);
  assert.equal(sent, false);
});

test('recibo persistido não volta a enviar confirmação', async () => {
  const api = await flowModule();
  const initial = { ...attempt(), receipt: { reference: 'already-created' } };
  const flow = api.createCheckoutFlow({
    confirm: async () => {
      throw new Error('Não deve enviar');
    },
  });
  assert.equal(await flow.confirm(initial), initial);
});

test('rejeição por stock ou preço mantém a resposta da API para permitir novo resumo explícito', async () => {
  const api = await flowModule();
  const rejection = { status: 422, message: 'O stock foi alterado.' };
  const flow = api.createCheckoutFlow({
    save: async () => {},
    confirm: async () => {
      throw rejection;
    },
  });
  await assert.rejects(flow.confirm(attempt()), (error) => error === rejection);
});

test('endpoints autenticados preservam tarifas e chaves sem calcular totais locais', async () => {
  const calls = [];
  const api = await load('src/features/checkout/services/checkoutApi.js', {
    '@/features/checkout/services/checkoutFlow': await flowModule(),
    '@/services/http/apiClient': {
      apiRequest: async (path, options) => {
        calls.push({ path, options });
        return options.includeResponseMetadata
          ? { data: { total: '125.00' }, serverDate: null, receivedAt: Date.now() }
          : { total: '125.00' };
      },
    },
  });
  await api.getAddresses('jwt');
  await api.createAddress('jwt', { municipality_id: 3, address: 'Rua A', phone: '923000000' });
  await api.getDeliveryOptions('jwt', 2);
  const result = await api.previewCheckout('jwt', attempt().previewPayload);
  await api.confirmCheckout('jwt', {
    preview_token: 'preview',
    idempotency_key: 'same-key',
    payment_method: 'REFERENCE',
  });
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      '/client/addresses',
      '/client/addresses',
      '/client/checkout/delivery-options?address_id=2',
      '/client/checkout/preview',
      '/client/checkout/confirm',
    ],
  );
  assert.equal(
    calls.every((call) => call.options.token === 'jwt'),
    true,
  );
  assert.equal(result.total, '125.00');
});

test('persistência do checkout isola contas e permite recuperar a tentativa', async () => {
  const values = new Map();
  const storage = await load('src/features/checkout/services/checkoutStorage.js', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': {
      getItemAsync: async (key) => values.get(key),
      setItemAsync: async (key, value) => values.set(key, value),
      deleteItemAsync: async (key) => values.delete(key),
    },
  });
  await storage.saveCheckoutAttempt(1, attempt());
  assert.equal((await storage.getCheckoutAttempt(1)).confirmKey, 'confirm-key-123456');
  assert.equal(await storage.getCheckoutAttempt(2), null);
  await storage.removeCheckoutAttempt(1);
  assert.equal(await storage.getCheckoutAttempt(1), null);
});

test('renovar resumo preserva a morada e entregas mas gera novas chaves', async () => {
  const api = await flowModule();
  const initial = attempt();
  initial.previewPayload.deliveries = [{ store_id: 4, delivery_method: 'PICKUP' }];
  const renewed = api.renewCheckoutAttempt(initial);
  assert.equal(renewed.previewPayload.address_id, initial.previewPayload.address_id);
  assert.deepEqual(renewed.previewPayload.deliveries, initial.previewPayload.deliveries);
  assert.notEqual(renewed.previewPayload.idempotency_key, initial.previewPayload.idempotency_key);
  assert.notEqual(renewed.confirmKey, initial.confirmKey);
  assert.equal(renewed.preview, undefined);
  assert.equal(initial.preview.preview_token, 'uuid-preview');
});

test('renovação não substitui confirmações pendentes nem compras já confirmadas', async () => {
  const api = await flowModule();
  assert.throws(() => api.renewCheckoutAttempt({ ...attempt(), confirmStarted: true }), /Retome/);
  assert.throws(
    () => api.renewCheckoutAttempt({ ...attempt(), receipt: { reference: 'order' } }),
    /Retome/,
  );
});

test('resumo recém-gerado continua válido com relógio do telemóvel adiantado ou atrasado', async () => {
  const api = await flowModule();
  const serverDate = 'Fri, 13 Nov 2026 05:00:00 GMT';
  for (const offset of [-86400000, 86400000, 3600000]) {
    const receivedAt = Date.parse(serverDate) + offset;
    const quote = api.synchronizePreview(
      { expires_at: '2026-11-13T05:15:00.000000+00:00' },
      serverDate,
      receivedAt,
    );
    assert.equal(api.previewExpired(quote, receivedAt), false);
    assert.equal(api.previewExpired(quote, receivedAt + 899999), false);
    assert.equal(api.previewExpired(quote, receivedAt + 900000), true);
  }
});

test('normalização de precisão não reinicia a validade de um resumo já expirado', async () => {
  const api = await flowModule();
  assert.equal(
    api.checkoutTimestamp('2026-11-13T05:15:00.123456Z'),
    Date.parse('2026-11-13T05:15:00.123Z'),
  );
  const quote = api.synchronizePreview(
    { expires_at: '2026-11-13T04:59:00Z' },
    'Fri, 13 Nov 2026 05:00:00 GMT',
    1000000,
  );
  assert.equal(api.previewExpired(quote, 1000000), true);
  assert.equal(api.previewExpired({ status: 'EXPIRED', expires_at: '2099-01-01T00:00:00Z' }), true);
});

test('data ilegível não bloqueia a confirmação local e mantém a validação do servidor', async () => {
  const api = await flowModule();
  let sent = false;
  const initial = attempt();
  initial.preview.expires_at = 'unsupported-date';
  const flow = api.createCheckoutFlow({
    save: async () => {},
    confirm: async () => {
      sent = true;
      throw { status: 422, message: 'O preview expirou.' };
    },
  });
  await assert.rejects(flow.confirm(initial), (error) => error.status === 422);
  assert.equal(sent, true);
});

test('edição de morada usa PUT privado e envia só os campos permitidos', async () => {
  let call;
  const api = await load('src/features/checkout/services/checkoutApi.js', {
    '@/services/http/apiClient': {
      apiRequest: async (path, options) => {
        call = { path, options };
      },
    },
    '@/features/checkout/services/checkoutFlow': { synchronizePreview() {} },
  });
  await api.updateAddress('jwt', 8, {
    municipality_id: 2,
    address: 'Rua nova',
    phone: '923000000',
    client_id: 999,
  });
  assert.equal(call.path, '/client/addresses/8');
  assert.equal(call.options.method, 'PUT');
  assert.equal(call.options.token, 'jwt');
  assert.deepEqual(JSON.parse(call.options.body), {
    municipality_id: 2,
    address: 'Rua nova',
    phone: '923000000',
  });
  assert.throws(() => api.updateAddress('jwt', '../8', {}), /inválida/);
});
