const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Usa a regra de apresentação real, sem resolver reclamações ou executar operações financeiras. */
function presentation() {
  return load('src/features/complaints/services/complaintDecision.js');
}

test('decisão final só aparece em reclamações resolvidas ou rejeitadas', async () => {
  const service = await presentation();
  for (const status of ['OPEN', 'IN_REVIEW', 'WAITING_CUSTOMER', 'CANCELLED', 'UNKNOWN'])
    assert.equal(service.complaintDecision({ status, resolution: 'Texto antigo' }), null);
  assert.equal(service.complaintDecision(null), null);
});

test('solução e justificação usam texto e data oficiais antes das notas do histórico', async () => {
  const service = await presentation();
  for (const status of ['RESOLVED', 'REJECTED']) {
    const result = service.complaintDecision({
      status,
      resolution: ' Decisão oficial. ',
      resolved_at: '2026-11-14T12:00:00Z',
      rejected_at: '2026-11-14T13:00:00Z',
      timeline: [
        { to_status: status, notes: 'Texto anterior', occurred_at: '2026-11-13T12:00:00Z' },
      ],
    });
    assert.equal(result.text, 'Decisão oficial.');
    assert.equal(result.rejected, status === 'REJECTED');
    assert.equal(
      result.date,
      status === 'REJECTED' ? '2026-11-14T13:00:00Z' : '2026-11-14T12:00:00Z',
    );
  }
});

test('API anterior usa apenas o acontecimento final correspondente, mesmo com histórico fora de ordem', async () => {
  const service = await presentation();
  const result = service.complaintDecision({
    status: 'REJECTED',
    timeline: [
      { to_status: 'REJECTED', notes: 'Justificação final.', occurred_at: '2026-11-14T13:00:00Z' },
      {
        to_status: 'IN_REVIEW',
        notes: 'Nota interna de análise.',
        occurred_at: '2026-11-14T14:00:00Z',
      },
      { to_status: 'REJECTED', notes: 'Texto anterior.', occurred_at: '2026-11-13T13:00:00Z' },
    ],
  });
  assert.equal(result.text, 'Justificação final.');
  assert.equal(result.date, '2026-11-14T13:00:00Z');
});

test('ausência de decisão descritiva não inventa solução nem data de encerramento', async () => {
  const service = await presentation();
  const result = service.complaintDecision({ status: 'RESOLVED', timeline: null });
  assert.equal(result.text, 'A decisão foi registada sem descrição disponível.');
  assert.equal(result.date, undefined);
});
