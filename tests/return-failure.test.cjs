const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Observa os campos multipart mantendo as regras reais de validação e preparação dos anexos. */
class Multipart {
  constructor() { this.parts = []; }
  append(...part) { this.parts.push(part); }
}
/** Carrega os serviços reais sem enviar ocorrências nem ler ficheiros de uma conta real. */
async function service(request) {
  const attachments = await load('src/features/returns/services/attachmentFiles.js', {
    'expo-file-system': { File: class { exists = true; async bytes() { return new Uint8Array([1]); } } },
  }, { FormData: Multipart });
  return load('src/features/delivery/services/returnFailureApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
    '@/features/returns/services/attachmentFiles': { attachmentFormData: attachments.attachmentFormData },
  });
}
const delivery = { id: 7, status: 'AWAITING_PICKUP', allowed_actions: ['CONFIRM_PICKUP'] };
const file = { uri: 'file:///cache/photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg', size: 1024 };

test('falhas de devolução respeitam a fase e não dependem de uma allowed_action ausente da API', async () => {
  const api = await service(async () => {});
  const codes = (status) => Array.from(api.returnFailureReasons({ status }), (reason) => reason.value);
  assert.deepEqual(codes('AWAITING_PICKUP'), ['CLIENT_UNAVAILABLE', 'ADDRESS_NOT_FOUND', 'CLIENT_REFUSED', 'PRODUCT_NOT_READY', 'VEHICLE_BREAKDOWN', 'ACCIDENT', 'OTHER']);
  assert.deepEqual(codes('PICKED_UP'), ['STORE_CLOSED', 'STORE_REFUSED_RECEIPT', 'VEHICLE_BREAKDOWN', 'ACCIDENT', 'OTHER']);
  assert.deepEqual(codes('IN_TRANSIT'), codes('PICKED_UP'));
  for (const status of ['PENDING', 'SCHEDULED', 'ACCEPTED', 'DELIVERED', 'PICKUP_FAILED', 'DELIVERY_FAILED', 'CANCELLED', 'unexpected']) assert.equal(codes(status).length, 0);
  assert.throws(() => api.returnFailurePayload(delivery, { reason: 'STORE_CLOSED' }));
  assert.throws(() => api.returnFailurePayload({ ...delivery, status: 'IN_TRANSIT' }, { reason: 'CLIENT_UNAVAILABLE' }));
});
test('observação opcional respeita 3000 caracteres e campos alheios não são enviados', async () => {
  const api = await service(async () => {});
  assert.deepEqual(JSON.parse(JSON.stringify(api.returnFailurePayload(delivery, { reason: 'OTHER', observation: '  ', status: 'DELIVERED' }))), { reason: 'OTHER' });
  assert.equal(api.returnFailurePayload(delivery, { reason: 'OTHER', observation: '  explicação  ' }).observation, 'explicação');
  assert.equal(api.returnFailurePayload(delivery, { reason: 'OTHER', observation: 'a'.repeat(3000) }).observation.length, 3000);
  assert.throws(() => api.returnFailurePayload(delivery, { reason: 'OTHER', observation: 'a'.repeat(3001) }));
  assert.throws(() => api.returnFailurePayload(delivery, { reason: 'INVALID' }));
});
test('envio sem anexo consulta o estado e realiza um único POST autenticado', async () => {
  const calls = [];
  const api = await service(async (path, options) => { calls.push({ path, options }); return options.method === 'POST' ? { return_delivery_status: 'PICKUP_FAILED' } : delivery; });
  const result = await api.reportReturnFailure('jwt', delivery, { reason: 'ADDRESS_NOT_FOUND', observation: '  Rua não localizada  ', latitude: 10, status: 'DELIVERED' });
  assert.equal(result.return_delivery_status, 'PICKUP_FAILED');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].path, '/delivery-person/return-deliveries/7');
  assert.equal(calls[0].options.method, undefined);
  assert.equal(calls[1].path, '/delivery-person/return-deliveries/7/failure');
  assert.equal(calls[1].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].options.body), { reason: 'ADDRESS_NOT_FOUND', observation: 'Rua não localizada' });
  assert.ok(calls.every(({ options }) => options.token === 'jwt'));
});
test('anexos usam multipart real com nome e tipo e o tempo de envio prolongado', async () => {
  const calls = [];
  const api = await service(async (path, options) => { calls.push({ path, options }); return delivery; });
  await api.reportReturnFailure('jwt', delivery, { reason: 'CLIENT_UNAVAILABLE', observation: 'Sem resposta', attachments: [file] });
  const options = calls[1].options;
  assert.ok(options.body instanceof Multipart);
  assert.deepEqual(options.body.parts.slice(0, 2), [['reason', 'CLIENT_UNAVAILABLE'], ['observation', 'Sem resposta']]);
  assert.equal(options.body.parts[2][0], 'attachments[0]');
  assert.equal(options.body.parts[2][1].name, 'photo.jpg');
  assert.equal(options.body.parts[2][1].type, 'image/jpeg');
  assert.equal(typeof options.body.parts[2][1].bytes, 'function');
  assert.equal(options.timeoutMs, 120000);
  assert.equal(options.headers, undefined);
});
test('valida anexos e referências antes de qualquer consulta privada', async () => {
  let calls = 0;
  const api = await service(async () => { calls++; return delivery; });
  for (const attachments of [[{ ...file, size: 10 * 1024 * 1024 + 1 }], [{ ...file, name: 'bad.exe' }], Array(6).fill(file), {}]) {
    await assert.rejects(api.reportReturnFailure('jwt', delivery, { reason: 'OTHER', attachments }));
  }
  for (const id of ['../7', 0, '9007199254740992']) await assert.rejects(api.reportReturnFailure('jwt', { ...delivery, id }, { reason: 'OTHER' }));
  assert.equal(calls, 0);
});
test('mudança de estado e perda de acesso impedem o POST e exigem nova consulta', async () => {
  for (const status of ['PICKED_UP', 'PICKUP_FAILED', 'CANCELLED']) {
    let calls = 0;
    const api = await service(async () => { calls++; return { ...delivery, status }; });
    await assert.rejects(api.reportReturnFailure('jwt', delivery, { reason: 'OTHER' }), (error) => error.requiresRefresh === true);
    assert.equal(calls, 1);
  }
  let calls = 0;
  const api = await service(async () => { calls++; throw { status: 403 }; });
  await assert.rejects(api.reportReturnFailure('jwt', delivery, { reason: 'OTHER' }), (error) => error.status === 403);
  assert.equal(calls, 1);
});
test('resposta incerta não repete o POST de ocorrência', async () => {
  for (const status of [0, 500]) {
    const calls = [];
    const api = await service(async (path, options) => { calls.push(options); if (options.method === 'POST') throw { status }; return delivery; });
    await assert.rejects(api.reportReturnFailure('jwt', delivery, { reason: 'OTHER' }), (error) => error.status === status);
    assert.equal(calls.filter((call) => call.method === 'POST').length, 1);
  }
});
