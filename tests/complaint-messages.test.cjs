const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Regista multipart para confirmar a utilização do serializador já validado no Android. */
class Multipart {
  constructor() {
    this.parts = [];
  }
  append(...parts) {
    this.parts.push(parts);
  }
}

/** Carrega serviços reais com transporte controlado, sem abrir nem enviar reclamações reais. */
async function api(request = async () => []) {
  const files = await load(
    'src/features/returns/services/attachmentFiles.js',
    {
      'expo-file-system': {
        File: class {
          exists = true;
          async bytes() {
            return new Uint8Array([1]);
          }
        },
      },
    },
    { FormData: Multipart },
  );
  const complaints = await load('src/features/complaints/services/complaintsApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
  return load('src/features/complaints/services/complaintMessagesApi.js', {
    '@/features/returns/services/attachmentFiles': files,
    '@/services/http/apiClient': { apiRequest: request },
    '@/features/complaints/services/complaintsApi': complaints,
  });
}
const complaint = { id: 6, status: 'WAITING_CUSTOMER' };
const file = {
  uri: 'file:///cache/photo.jpg',
  name: 'photo.jpg',
  mimeType: 'image/jpeg',
  size: 200,
};

test('reclamação consulta o histórico privado e revalida o estado antes do envio JSON', async () => {
  const calls = [];
  const history = [{ id: 1 }];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    return path.endsWith('/messages') ? history : complaint;
  });
  assert.deepEqual(await service.getComplaintMessages('jwt', 6), history);
  assert.deepEqual(
    await service.sendComplaintMessage('jwt', complaint, ' Mais informação. '),
    history,
  );
  assert.equal(calls[1].path, '/client/complaints/6');
  assert.equal(calls[2].path, '/client/complaints/6/messages');
  assert.equal(calls[2].options.method, 'POST');
  assert.deepEqual(JSON.parse(calls[2].options.body), { message: 'Mais informação.' });
  assert.ok(calls.every(({ options }) => options.token === 'jwt'));
});

test('só WAITING_CUSTOMER permite responder; estados novos e finais bloqueiam envio', async () => {
  let count = 0;
  const service = await api(async () => {
    count++;
  });
  for (const status of ['OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'CANCELLED', 'UNKNOWN']) {
    assert.equal(service.complaintConversationOpen(status), false);
    await assert.rejects(
      service.sendComplaintMessage('jwt', { ...complaint, status }, 'Resposta'),
      /não está/,
    );
  }
  assert.equal(service.complaintConversationOpen('WAITING_CUSTOMER'), true);
  assert.equal(count, 0);
  assert.equal(service.complaintConversation.closedTitle('IN_REVIEW'), 'A aguardar análise');
  assert.equal(service.complaintConversation.closedTitle('RESOLVED'), 'Conversa encerrada');
});

test('retomar análise entre leitura e envio impede o POST e solicita atualização do estado', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    return { ...complaint, status: 'IN_REVIEW' };
  });
  await assert.rejects(
    service.sendComplaintMessage('jwt', complaint, 'Resposta'),
    (error) => error.status === 422,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/client/complaints/6');
  assert.equal(calls[0].options.method, undefined);
});

test('anexos usam multipart com texto, prazo de upload e ficheiros por bytes', async () => {
  let options;
  const service = await api(async (path, next) => {
    if (!path.endsWith('/messages')) return complaint;
    options = next;
    return [];
  });
  await service.sendComplaintMessage('jwt', complaint, 'Fotografia solicitada', [file]);
  assert.ok(options.body instanceof Multipart);
  assert.equal(options.timeoutMs, 120000);
  assert.equal(options.body.parts[0][0], 'message');
  assert.equal(options.body.parts[1][0], 'attachments[0]');
  assert.equal(typeof options.body.parts[1][1].bytes, 'function');
});

test('mensagem inválida e anexos excessivos são rejeitados antes de consultar ou enviar', async () => {
  let count = 0;
  const service = await api(async () => {
    count++;
  });
  for (const text of ['', 'a', 'x'.repeat(5001)])
    await assert.rejects(service.sendComplaintMessage('jwt', complaint, text), /2 a 5000/);
  await assert.rejects(
    service.sendComplaintMessage('jwt', complaint, 'Resposta', Array(6).fill(file)),
    /até 5/,
  );
  await assert.rejects(
    service.sendComplaintMessage('jwt', complaint, 'Resposta', [
      { ...file, size: 11 * 1024 * 1024 },
    ]),
    /10 MB/,
  );
  assert.equal(count, 0);
});

test('envio incerto e histórico inválido não repetem o POST; falhas de sessão são preservadas', async () => {
  let posts = 0;
  const failure = { status: 0 };
  const service = await api(async (path) => {
    if (!path.endsWith('/messages')) return complaint;
    posts++;
    throw failure;
  });
  await assert.rejects(
    service.sendComplaintMessage('jwt', complaint, 'Resposta'),
    (error) => error === failure,
  );
  assert.equal(posts, 1);
  const malformed = await api(async (path) => (path.endsWith('/messages') ? {} : complaint));
  await assert.rejects(
    malformed.sendComplaintMessage('jwt', complaint, 'Resposta'),
    (error) => error.status === 500,
  );
  const denied = await api(async () => {
    throw { status: 401 };
  });
  await assert.rejects(denied.getComplaintMessages('jwt', 6), (error) => error.status === 401);
  assert.throws(() => service.getComplaintMessages('jwt', '../6'), /inválida/);
});
