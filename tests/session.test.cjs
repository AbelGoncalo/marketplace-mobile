const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

const clientPath = 'src/services/http/apiClient.js';
const config = { '@/config/env': { env: { apiUrl: 'https://example.test/api/' } } };

test('401 notifica apenas para pedidos autenticados e permite cancelar a subscrição', async () => {
  const api = await load(clientPath, config, {
    fetch: async () => ({ ok: false, status: 401, json: async () => ({ message: 'Expirada' }) }),
  });
  const tokens = [];
  const unsubscribe = api.onUnauthorized((token) => tokens.push(token));
  await assert.rejects(api.apiRequest('/auth/me', { token: 'old' }), { status: 401 });
  await assert.rejects(api.apiRequest('/auth/login'), { status: 401 });
  unsubscribe();
  await assert.rejects(api.apiRequest('/auth/me', { token: 'new' }), { status: 401 });
  assert.deepEqual(tokens, ['old']);
});

test('cliente envia bearer e corpo e aceita logout sem dados', async () => {
  let request;
  const api = await load(clientPath, config, {
    fetch: async (url, options) => {
      request = { url, ...options };
      return { ok: true, json: async () => ({ data: null }) };
    },
  });
  assert.equal(await api.apiRequest('/auth/logout', { token: 'secret', method: 'POST' }), null);
  assert.equal(request.url, 'https://example.test/api/auth/logout');
  assert.equal(request.headers.Authorization, 'Bearer secret');
  assert.equal(request.method, 'POST');
});

test('pedidos bloqueados são abortados e devolvem erro de rede previsível', async () => {
  const api = await load(clientPath, config, {
    setTimeout: (callback) => setTimeout(callback, 1),
    fetch: (_, { signal }) =>
      new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')));
      }),
  });
  await assert.rejects(api.apiRequest('/auth/me'), { status: 0 });
});

test('sessões danificadas são removidas e sessões válidas são restauradas', async () => {
  for (const value of [
    '{broken',
    '{}',
    '{"token":42,"user":{"id":1}}',
    '{"token":"","user":{"id":1}}',
  ]) {
    let removed = false;
    const storage = await load('src/services/storage/sessionStorage.js', {
      'react-native': { Platform: { OS: 'android' } },
      'expo-secure-store': {
        getItemAsync: async () => value,
        deleteItemAsync: async () => {
          removed = true;
        },
        setItemAsync: async () => {},
      },
    });
    assert.equal(await storage.getStoredSession(), null);
    assert.equal(removed, true);
  }
  const storage = await load('src/services/storage/sessionStorage.js', {
    'react-native': { Platform: { OS: 'android' } },
    'expo-secure-store': { getItemAsync: async () => '{"token":"valid","user":{"id":1}}' },
  });
  assert.equal((await storage.getStoredSession()).token, 'valid');
});

test('nome de conta não concede acesso administrativo sem papel explícito', async () => {
  const access = await load('src/features/auth/utils/accessControl.js');
  assert.equal(
    access.getManagementRoute({ user: { accountType: 'Administrador', roles: [] } }),
    null,
  );
  assert.equal(
    access.getManagementRoute({ user: { roles: ['super-admin'] } }),
    '/(super-admin)/super-admin',
  );
});

test('metadados HTTP expõem a data do servidor sem enviar opções internas ao fetch', async () => {
  let request;
  const api = await load(clientPath, config, {
    fetch: async (_, options) => {
      request = options;
      return {
        ok: true,
        headers: { get: () => 'Fri, 13 Nov 2026 05:00:00 GMT' },
        json: async () => ({ data: { total: '10.00' } }),
      };
    },
  });
  const result = await api.apiRequest('/client/checkout/preview', {
    includeResponseMetadata: true,
  });
  assert.equal(result.data.total, '10.00');
  assert.equal(result.serverDate, 'Fri, 13 Nov 2026 05:00:00 GMT');
  assert.equal(Number.isFinite(result.receivedAt), true);
  assert.equal(request.includeResponseMetadata, undefined);
});

test('multipart deixa o fetch definir Content-Type e não envia opções internas', async () => {
  class Multipart {
    append() {}
  }
  let request;
  const api = await load(clientPath, config, {
    FormData: Multipart,
    fetch: async (_, options) => {
      request = options;
      return { ok: true, json: async () => ({ data: { id: 1 } }) };
    },
  });
  const body = new Multipart();
  await api.apiRequest('/client/returns', {
    token: 'jwt',
    body,
    method: 'POST',
    timeoutMs: 120000,
  });
  assert.equal(request.body, body);
  assert.equal(request.headers['Content-Type'], undefined);
  assert.equal(request.headers.Authorization, 'Bearer jwt');
  assert.equal(request.timeoutMs, undefined);
});

test('downloads autenticados devolvem bytes e preservam expiração de sessão', async () => {
  const bytes = new ArrayBuffer(4);
  let request;
  const api = await load(clientPath, config, {
    fetch: async (_, options) => {
      request = options;
      return {
        ok: true,
        arrayBuffer: async () => bytes,
        json: () => {
          throw new Error('Não é JSON');
        },
      };
    },
  });
  assert.equal(
    await api.apiRequest('/client/returns/attachments/1', {
      token: 'jwt',
      responseType: 'arrayBuffer',
    }),
    bytes,
  );
  assert.equal(request.headers.Authorization, 'Bearer jwt');
  assert.equal(request.responseType, undefined);
  const expired = await load(clientPath, config, {
    fetch: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Sessão expirada' }),
    }),
  });
  const tokens = [];
  expired.onUnauthorized((token) => tokens.push(token));
  await assert.rejects(
    expired.apiRequest('/client/returns/attachments/1', {
      token: 'old',
      responseType: 'arrayBuffer',
    }),
    { status: 401 },
  );
  assert.deepEqual(tokens, ['old']);
});
