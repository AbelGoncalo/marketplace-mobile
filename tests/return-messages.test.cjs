const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Expõe as partes multipart para verificar texto e anexos no contrato real. */
class Multipart {
  constructor() {
    this.parts = [];
  }
  append(...args) {
    this.parts.push(args);
  }
}

/** Carrega as regras e o serviço reais com transporte controlado, sem enviar mensagens reais. */
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
  const returns = await load('src/features/returns/services/returnsApi.js', {
    '@/features/returns/services/attachmentFiles': files,
    '@/services/http/apiClient': { apiRequest: request },
  });
  return load('src/features/returns/services/returnMessagesApi.js', {
    '@/features/returns/services/attachmentFiles': files,
    '@/features/returns/services/returnsApi': returns,
    '@/services/http/apiClient': { apiRequest: request },
  });
}

const request = { id: 4, status: 'UNDER_REVIEW' };
const file = { uri: 'file:///photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg', size: 200 };

test('conversa consulta histórico privado e envia JSON autenticado sem anexos', async () => {
  const calls = [];
  const history = [{ id: 1, sender_role: 'CLIENT', message: 'Obrigado' }];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
    return history;
  });
  assert.equal(await service.getReturnMessages('jwt', 4), history);
  assert.equal(await service.sendReturnMessage('jwt', request, ' Fotografias enviadas. '), history);
  assert.equal(calls[0].path, '/client/returns/4/messages');
  assert.equal(calls[0].options.token, 'jwt');
  assert.equal(calls[0].options.method, undefined);
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.token, 'jwt');
  assert.deepEqual(JSON.parse(calls[1].options.body), { message: 'Fotografias enviadas.' });
});

test('resposta com imagem usa multipart e o campo attachments reconhecido pela API', async () => {
  let options;
  const service = await api(async (_, next) => {
    options = next;
    return [];
  });
  await service.sendReturnMessage('jwt', request, 'Seguem as fotografias.', [file]);
  assert.equal(options.timeoutMs, 120000);
  assert.ok(options.body instanceof Multipart);
  assert.deepEqual(Array.from(options.body.parts[0]), ['message', 'Seguem as fotografias.']);
  assert.equal(options.body.parts[1][0], 'attachments[0]');
  assert.equal(options.body.parts[1][1].name, file.name);
  assert.equal(typeof options.body.parts[1][1].bytes, 'function');
});

test('estados encerrados ou desconhecidos bloqueiam envio e preservam consultas', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
    return [];
  });
  for (const status of ['ACCEPTED', 'REFUSED', 'REJECTED', 'CANCELLED', 'NEW_STATE', undefined]) {
    assert.equal(service.returnConversationOpen(status), false);
    assert.throws(
      () => service.sendReturnMessage('jwt', { id: 4, status }, 'Teste válido'),
      /encerrada/,
    );
  }
  assert.equal(calls, 0);
  await service.getReturnMessages('jwt', 4);
  assert.equal(calls, 1);
  for (const status of [
    'REQUESTED',
    'UNDER_REVIEW',
    'APPROVED',
    'AWAITING_RETURN',
    'IN_TRANSIT',
    'RECEIVED',
    'INSPECTING',
  ])
    assert.equal(service.returnConversationOpen(status), true);
});

test('mensagem inválida e anexos acima dos limites não são enviados', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
    return [];
  });
  for (const text of ['', ' a ', 'x'.repeat(5001), null])
    assert.throws(() => service.sendReturnMessage('jwt', request, text), /2 a 5000/);
  assert.throws(
    () => service.sendReturnMessage('jwt', request, 'Texto válido', Array(6).fill(file)),
    /até 5/,
  );
  assert.throws(
    () =>
      service.sendReturnMessage('jwt', request, 'Texto válido', [
        { ...file, size: 11 * 1024 * 1024 },
      ]),
    /10 MB/,
  );
  assert.throws(() => service.getReturnMessages('jwt', '../4'), /identificador/);
  assert.equal(calls, 0);
});

test('histórico é cronológico e não duplica mensagens após envio e atualização', async () => {
  const service = await api();
  const first = { id: 1, created_at: '2026-11-14T10:00:00Z' };
  const second = { id: 2, created_at: '2026-11-14T10:01:00Z' };
  const original = [second, first];
  assert.deepEqual(
    Array.from(service.mergeReturnMessages(original, [second]), (message) => message.id),
    [1, 2],
  );
  assert.equal(original[0].id, 2);
});

test('recuperação de envio incerto ignora mensagens antigas e respostas do Centro com texto igual', async () => {
  const service = await api();
  const attempt = { knownIds: [1], message: 'Segue a foto.', attachments: [file] };
  const old = {
    id: 1,
    sender_role: 'CLIENT',
    message: attempt.message,
    attachments: [{ name: file.name, size: 200 }],
  };
  const center = { ...old, id: 2, sender_role: 'SHOPPING_CENTER_ADMIN' };
  const different = { ...old, id: 3, attachments: [] };
  assert.equal(service.findConfirmedReturnMessage([old, center, different], attempt), null);
  const delivered = { ...old, id: 4 };
  assert.equal(service.findConfirmedReturnMessage([old, delivered], attempt), delivered);
});

test('falha ou resposta inválida não repetem automaticamente a mensagem', async () => {
  let calls = 0;
  const failure = { status: 0, message: 'Sem ligação' };
  const service = await api(async () => {
    calls++;
    throw failure;
  });
  await assert.rejects(
    service.sendReturnMessage('jwt', request, 'Teste válido'),
    (error) => error === failure,
  );
  assert.equal(calls, 1);
  const broken = await api(async () => null);
  await assert.rejects(
    broken.sendReturnMessage('jwt', request, 'Teste válido'),
    (error) => error.status === 500,
  );
});
