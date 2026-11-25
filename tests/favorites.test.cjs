const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');
/** Verifica transporte e identidade sem guardar favoritos numa conta real. */
function api(request) {
  return load('src/features/favorites/services/favoritesApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
}
test('favoritos usam consulta paginada e estados explícitos PUT e DELETE', async () => {
  const calls = [];
  const service = await api(async (path, options) => {
    calls.push({ path, options });
  });
  await service.getFavorites('jwt', 2);
  await service.getFavorite('jwt', 4);
  await service.setFavorite('jwt', 4, true);
  await service.setFavorite('jwt', 4, false);
  assert.equal(calls[0].path, '/client/favorites?page=2&per_page=15');
  assert.equal(calls[2].options.method, 'PUT');
  assert.equal(calls[3].options.method, 'DELETE');
  assert.ok(calls.every(({ options }) => options.token === 'jwt'));
  assert.throws(() => service.setFavorite('jwt', '../4', true));
  assert.throws(() => service.setFavorite('jwt', 4, 'true'));
});
test('falha de gravação não repete o pedido', async () => {
  let calls = 0;
  const service = await api(async () => {
    calls++;
    throw { status: 0 };
  });
  await assert.rejects(service.setFavorite('jwt', 4, true));
  assert.equal(calls, 1);
});
