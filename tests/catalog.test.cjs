const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');

// Simula apenas o transporte HTTP; os contratos e as transformações são os da aplicação.
const apiPath = 'src/features/catalog/services/catalogApi.js';
const presentationPath = 'src/features/catalog/utils/productPresentation.js';
const configuration = { '@/config/env': { env: { apiUrl: 'https://example.test/api' } } };

/** Carrega os serviços do catálogo com um transporte controlado por cada cenário. */
function catalog(request = async () => ({})) {
  return load(
    apiPath,
    { '@/services/http/apiClient': { apiRequest: request } },
    { URLSearchParams },
  );
}

test('pesquisa preserva acentos e caracteres especiais sem introduzir filtros adicionais', async () => {
  const api = await catalog();
  const path = api.buildProductsPath({
    search: '  café & pão?  ',
    categoryId: '4',
    promotion: true,
    sort: 'price_asc',
    page: 3,
  });
  const url = new URL(path, 'https://example.test');
  assert.equal(url.searchParams.get('search'), 'café & pão?');
  assert.equal(url.searchParams.get('filter[category_id]'), '4');
  assert.equal(url.searchParams.get('filter[has_promotion]'), '1');
  assert.equal(url.searchParams.get('sort'), 'price_asc');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(url.searchParams.get('per_page'), '20');
});

test('catálogo sem filtros omite pesquisa, categoria e promoção', async () => {
  const api = await catalog();
  const params = new URL(api.buildProductsPath(), 'https://example.test').searchParams;
  assert.equal(params.has('search'), false);
  assert.equal(params.has('filter[category_id]'), false);
  assert.equal(params.has('filter[has_promotion]'), false);
  assert.equal(params.get('page'), '1');
});

test('serviços públicos preservam os metadados de paginação e não enviam tokens', async () => {
  const calls = [];
  const page = { data: [{ id: 7 }], current_page: 2, last_page: 3, total: 43 };
  const api = await catalog(async (...args) => {
    calls.push(args);
    return page;
  });
  assert.equal(await api.getCatalogProducts({ page: 2 }), page);
  await api.getHomeContent();
  await api.getCatalogCategories();
  await api.getCatalogProduct('7');
  assert.equal(calls[0].length, 1);
  assert.equal(calls[1][0], '/home');
  assert.equal(calls[2][0], '/auxiliary/product-categories');
  assert.equal(calls[3][0], '/products/7');
});

test('detalhe rejeita identificadores inválidos sem consultar o servidor', async () => {
  let calls = 0;
  const api = await catalog(async () => {
    calls += 1;
  });
  for (const id of ['', 'abc', '-1', '0', '1.2', '9007199254740992']) {
    await assert.rejects(api.getCatalogProduct(id), /identificador/);
  }
  assert.equal(calls, 0);
});

test('produto removido apresenta mensagem própria e erros de rede são preservados', async () => {
  const api = await catalog(async () => {
    throw { status: 404 };
  });
  await assert.rejects(api.getCatalogProduct(1), /já não está disponível/);
  const networkError = new Error('Sem rede');
  const offline = await catalog(async () => {
    throw networkError;
  });
  await assert.rejects(offline.getCatalogProduct(1), (error) => error === networkError);
});

test('promoções nulas, zero ou superiores ao preço normal não substituem o preço', async () => {
  const presentation = await load(presentationPath, configuration);
  for (const promotional of [null, undefined, '0', '-1', '100', '120']) {
    const pricing = presentation.productPricing('100', promotional);
    assert.equal(pricing.price, '100');
    assert.equal(pricing.oldPrice, null);
  }
  const pricing = presentation.productPricing('100', '80');
  assert.equal(pricing.price, '80');
  assert.equal(pricing.oldPrice, '100');
  assert.match(presentation.formatPrice('80.25'), /80,25.*AOA/);
  assert.equal(presentation.formatPrice(null), 'Preço indisponível');
});

test('imagens locais usam o disco público e esquemas não HTTP são rejeitados', async () => {
  const presentation = await load(presentationPath, configuration);
  assert.equal(
    presentation.productImageUrl('products/7/photo.jpg'),
    'https://example.test/storage/products/7/photo.jpg',
  );
  assert.equal(
    presentation.productImageUrl('/storage/products/a.jpg'),
    'https://example.test/storage/products/a.jpg',
  );
  assert.equal(presentation.productImageUrl('https://cdn.test/a.jpg'), 'https://cdn.test/a.jpg');
  assert.equal(presentation.productImageUrl('data:image/png;base64,abc'), null);
  assert.equal(presentation.productImageUrl('javascript:alert(1)'), null);
  assert.equal(presentation.productImageUrl('//cdn.test/a.jpg'), null);
  assert.equal(presentation.productImageUrl(null), null);
});
