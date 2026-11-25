const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Exercita o serviço real sem consultar nem movimentar dinheiro numa conta existente. */
function api(request = async () => ({})) {
  return load('src/features/refunds/services/refundsApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
}

test('reembolsos consultam lista paginada e detalhe com JWT, sem operações financeiras', async () => {
  const calls = [];
  const page = { data: [{ id: 12, refund_amount: '1250.45', currency: 'AOA' }], last_page: 2 };
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    return page;
  });
  assert.equal(await service.getRefunds('jwt', 2), page);
  assert.equal(await service.getRefund('jwt', '12'), page);
  assert.equal(calls[0].path, '/client/refunds?page=2&per_page=15');
  assert.equal(calls[1].path, '/client/refunds/12');
  assert.ok(
    calls.every(({ options }) => options.token === 'jwt' && !options.method && !options.body),
  );
});

test('referências e páginas inválidas não consultam dados privados', async () => {
  let count = 0;
  const service = await api(async () => {
    count++;
  });
  for (const invalid of ['../2', '', null, 0, -1, 1.5, '2.0', '9007199254740992']) {
    assert.throws(() => service.getRefund('jwt', invalid), /inválida/);
    assert.throws(() => service.getRefunds('jwt', invalid), /inválida/);
  }
  assert.equal(count, 0);
});

test('consulta preserva valores oficiais e falhas de sessão, propriedade ou rede sem repetição', async () => {
  for (const status of [0, 401, 403, 404, 500]) {
    let count = 0;
    const failure = { status, message: 'Falha' };
    const service = await api(async () => {
      count++;
      throw failure;
    });
    await assert.rejects(service.getRefund('jwt', 8), (error) => error === failure);
    assert.equal(count, 1);
  }
});

test('só REFUNDED é apresentado como reembolsado, com alternativa para estado desconhecido', async () => {
  const service = await api();
  for (const status of [
    'PENDING',
    'UNDER_REVIEW',
    'APPROVED',
    'PROCESSING',
    'FAILED',
    'REJECTED',
    'CANCELLED',
  ]) {
    assert.notEqual(service.refundStatus(status).label, 'Reembolsado');
    assert.ok(service.refundStatus(status).description);
  }
  assert.equal(service.refundStatus('REFUNDED').label, 'Reembolsado');
  assert.equal(service.refundStatus('OTHER').label, 'Estado em atualização');
  assert.equal(service.refundTransactionStatus('PENDING_CONFIRMATION'), 'A aguardar confirmação');
  assert.equal(service.refundTransactionStatus('SUCCEEDED'), 'Concluída');
  assert.equal(service.refundTransactionStatus('FAILED'), 'Falhou');
  assert.equal(service.refundTransactionStatus('OTHER'), 'Estado em atualização');
});
