const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

/** Simula o armazenamento e o transporte mantendo a fila real de operações do carrinho. */
async function cartService(request, initialToken = null) {
  let stored = initialToken;
  const module = await load('src/features/cart/services/cartApi.js', {
    '@/services/http/apiClient': { apiRequest: request },
    '@/features/cart/services/cartStorage': {
      getGuestCartToken: async () => stored,
      saveGuestCartToken: async (token) => {
        stored = token;
      },
      removeGuestCartToken: async () => {
        stored = null;
      },
    },
  });
  return {
    service: module.createCartService(),
    stored: () => stored,
    validQuantity: module.validQuantity,
  };
}

test('primeira consulta guarda o token visitante e reutiliza-o nas alterações', async () => {
  const calls = [];
  const cart = await cartService(async (path, options) => {
    calls.push({ path, options });
    return {
      cart: { total_quantity: calls.length - 1 },
      stores: [],
      cart_token: calls.length === 1 ? 'guest-secret' : null,
    };
  });
  await cart.service.load();
  await cart.service.add(null, 34, 2);
  assert.equal(cart.stored(), 'guest-secret');
  assert.equal(calls[1].options.headers['X-Cart-Token'], 'guest-secret');
  assert.equal(calls[1].options.token, undefined);
  assert.equal(calls[1].path, '/cart/items');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    store_product_variant_id: 34,
    quantity: 2,
  });
});

test('consultas simultâneas aguardam a criação do primeiro carrinho visitante', async () => {
  let active = 0;
  let maximum = 0;
  const headers = [];
  const cart = await cartService(async (_, options) => {
    active += 1;
    maximum = Math.max(maximum, active);
    headers.push(options.headers['X-Cart-Token']);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return { cart_token: 'same-guest' };
  });
  await Promise.all([cart.service.load(), cart.service.load()]);
  assert.equal(maximum, 1);
  assert.deepEqual(headers, [undefined, 'same-guest']);
});

test('login funde o visitante antes de carregar o carrinho da conta e elimina a credencial antiga', async () => {
  const calls = [];
  const cart = await cartService(async (path, options) => {
    calls.push({ path, options });
    return { cart: { total_quantity: 4 } };
  }, 'visitor-before-login');
  await cart.service.load('jwt-client');
  await cart.service.load('jwt-client');
  assert.deepEqual(
    calls.map((call) => call.path),
    ['/cart/merge', '/cart', '/cart'],
  );
  assert.equal(calls[0].options.token, 'jwt-client');
  assert.deepEqual(JSON.parse(calls[0].options.body), { cart_token: 'visitor-before-login' });
  assert.equal(cart.stored(), null);
  assert.equal(calls[1].options.headers, undefined);
});

test('fusão com falha de rede preserva o visitante e impede a alteração seguinte', async () => {
  const calls = [];
  const cart = await cartService(async (path) => {
    calls.push(path);
    throw { status: 0, message: 'Sem rede' };
  }, 'keep-guest');
  await assert.rejects(cart.service.add('jwt', 1, 1), (error) => error.status === 0);
  assert.equal(cart.stored(), 'keep-guest');
  assert.deepEqual(calls, ['/cart/merge']);
});

test('visitante expirado confirmado por 404 permite carregar a conta', async () => {
  const paths = [];
  const cart = await cartService(async (path) => {
    paths.push(path);
    if (path === '/cart/merge') throw { status: 404 };
    return {};
  }, 'expired');
  await cart.service.load('jwt');
  assert.deepEqual(paths, ['/cart/merge', '/cart']);
  assert.equal(cart.stored(), null);
});

test('uma alteração rejeitada não é repetida automaticamente e não bloqueia consultas posteriores', async () => {
  const paths = [];
  const cart = await cartService(async (path) => {
    paths.push(path);
    if (path === '/cart/items') throw { status: 422 };
    return { cart: { total_amount: '123.45' } };
  }, 'guest');
  await assert.rejects(cart.service.add(null, 1, 100), (error) => error.status === 422);
  const result = await cart.service.load();
  assert.deepEqual(paths, ['/cart/items', '/cart']);
  assert.equal(result.cart.total_amount, '123.45');
});

test('atualização, remoção e limpeza usam os métodos oficiais e o JWT da conta', async () => {
  const calls = [];
  const cart = await cartService(async (path, options) => {
    calls.push({ path, options });
    return {};
  });
  await cart.service.update('jwt', 5, 3);
  await cart.service.remove('jwt', 5);
  await cart.service.clear('jwt');
  assert.deepEqual(
    calls.map((call) => [call.path, call.options.method]),
    [
      ['/cart/items/5', 'PATCH'],
      ['/cart/items/5', 'DELETE'],
      ['/cart/items', 'DELETE'],
    ],
  );
  assert.deepEqual(JSON.parse(calls[0].options.body), { quantity: 3 });
  assert.equal(
    calls.every((call) => call.options.token === 'jwt'),
    true,
  );
});

test('quantidades e identificadores inválidos são rejeitados antes da rede', async () => {
  let calls = 0;
  const cart = await cartService(async () => {
    calls += 1;
    return {};
  });
  for (const value of ['', 0, -1, 1.5, 'abc', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => cart.validQuantity(value), /quantidade/);
  }
  assert.equal(cart.validQuantity('2'), 2);
  assert.throws(() => cart.service.update(null, '../other', 1), /identificador/);
  assert.equal(calls, 0);
});

test('sair da conta não expõe o seu JWT nem o seu carrinho ao visitante seguinte', async () => {
  const calls = [];
  const cart = await cartService(async (path, options) => {
    calls.push({ path, options });
    return { cart_token: options.token ? null : 'new-visitor' };
  });
  await cart.service.load('jwt-old');
  await cart.service.load();
  assert.equal(calls[1].options.token, undefined);
  assert.equal(calls[1].options.headers['X-Cart-Token'], undefined);
  assert.equal(cart.stored(), 'new-visitor');
});

test('contador distingue artigos de unidades e soma linhas de várias lojas', async () => {
  const { cartItemCount } = await load('src/features/cart/utils/cartCounts.js');
  assert.equal(cartItemCount(null), 0);
  assert.equal(cartItemCount({ stores: [{ items: [{ id: 1, quantity: 2 }] }] }), 1);
  assert.equal(
    cartItemCount({
      stores: [{ items: [{ id: 1, quantity: 2 }] }, { items: [{ id: 2, quantity: 5 }] }],
    }),
    2,
  );
});
