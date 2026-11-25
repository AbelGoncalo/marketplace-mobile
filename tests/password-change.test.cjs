const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');
/** Verifica o contrato real sem alterar palavras-passe de contas existentes. */
function service(request = async () => null) {
  return load('src/features/profile/services/passwordApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
  });
}
const values = {
  current_password: 'Anterior1',
  password: ' NovaSenha2 ',
  password_confirmation: ' NovaSenha2 ',
};
test('alteração envia só os três campos oficiais e preserva espaços', async () => {
  let call;
  const api = await service(async (path, options) => {
    call = { path, options };
  });
  await api.changePassword('jwt', { ...values, user_id: 999 });
  assert.equal(call.path, '/auth/password');
  assert.equal(call.options.method, 'PUT');
  assert.equal(call.options.token, 'jwt');
  assert.deepEqual(JSON.parse(call.options.body), values);
});
test('campos inválidos e confirmação diferente não enviam alteração', async () => {
  let count = 0;
  const api = await service(async () => {
    count++;
  });
  for (const patch of [
    { current_password: '' },
    { password: 'curta' },
    { password: 'abcdefgh1' },
    { password: 'ABCDEFGH1' },
    { password: 'Abcdefgh' },
    { password_confirmation: 'Outra1' },
  ]) {
    assert.throws(() => api.changePassword('jwt', { ...values, ...patch }));
  }
  assert.equal(count, 0);
});
test('falha incerta não repete o pedido e mantém o erro original', async () => {
  let count = 0;
  const failure = { status: 0 };
  const api = await service(async () => {
    count++;
    throw failure;
  });
  await assert.rejects(api.changePassword('jwt', values), (error) => error === failure);
  assert.equal(count, 1);
});
