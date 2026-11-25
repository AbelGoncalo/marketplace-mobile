const { test } = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./moduleLoader.cjs');
const { readFile } = require('node:fs/promises');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');

const selected = {
  uri: 'file:///cache/photo.jpg',
  name: 'photo.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
};

/** Regista partes multipart sem simular a lógica que estamos a testar. */
class Multipart {
  constructor() {
    this.parts = [];
  }
  append(...args) {
    this.parts.push(args);
  }
  entries() {
    return this.parts.map(([key, value]) => [key, value]);
  }
}

/** Carrega as regras reais com FormData observável no ambiente Node. */
function files() {
  return load(
    'src/features/returns/services/attachmentFiles.js',
    {
      'expo-file-system': {
        File: class {
          constructor(uri) {
            this.uri = uri;
            this.exists = true;
          }
          async bytes() {
            return new TextEncoder().encode('conteudo-do-ficheiro');
          }
        },
      },
    },
    { FormData: Multipart },
  );
}

test('anexos validam formato, tamanho conhecido, limite de 10 MB e quantidade máxima', async () => {
  const service = await files();
  assert.equal(
    service.normalizeAttachment({ ...selected, size: 10 * 1024 * 1024 }).size,
    10 * 1024 * 1024,
  );
  assert.equal(
    service.normalizeAttachment({ ...selected, mimeType: undefined }).mimeType,
    'image/jpeg',
  );
  for (const file of [
    { ...selected, name: 'file.exe' },
    { ...selected, size: 10 * 1024 * 1024 + 1 },
    { ...selected, size: undefined },
    { ...selected, size: 0 },
    { ...selected, mimeType: 'application/pdf' },
    { ...selected, uri: '' },
  ])
    assert.throws(() => service.normalizeAttachment(file));
  const six = Array.from({ length: 6 }, (_, id) => ({
    ...selected,
    uri: `file:///${id}.jpg`,
    name: `${id}.jpg`,
  }));
  assert.throws(() => service.addAttachments([], six), /até 5/);
  assert.equal(service.addAttachments([], six.slice(0, 5)).length, 5);
});

test('seleções repetidas são ignoradas e uma seleção inválida não altera a lista anterior', async () => {
  const service = await files();
  const current = [selected];
  assert.equal(service.addAttachments(current, [selected]).length, 1);
  assert.throws(() => service.addAttachments(current, [{ ...selected, size: 11 * 1024 * 1024 }]));
  assert.equal(current.length, 1);
  assert.equal(service.addAttachments([], [selected, selected]).length, 1);
});

test('multipart conserva campos e usa as chaves attachments esperadas pelo Laravel', async () => {
  const service = await files();
  const form = service.attachmentFormData({ order_id: 8, quantity: 1 }, [selected]);
  assert.deepEqual(
    form.parts.slice(0, 2).map((part) => Array.from(part)),
    [
      ['order_id', '8'],
      ['quantity', '1'],
    ],
  );
  assert.equal(form.parts[2][0], 'attachments[0]');
  assert.equal(form.parts[2][1].name, selected.name);
  assert.equal(typeof form.parts[2][1].bytes, 'function');
  assert.equal(form.parts[2][1].type, 'image/jpeg');
  const browserFile = { name: 'browser.jpg' };
  const web = service.attachmentFormData({}, [{ ...selected, file: browserFile }]);
  assert.equal(web.parts[0][1], browserFile);
  assert.equal(web.parts[0][2], selected.name);
});

test('criação com anexos usa multipart e um único pedido autenticado com prazo de upload', async () => {
  const helpers = await files();
  let calls = 0;
  let options;
  const service = await load('src/features/returns/services/returnsApi.js', {
    '@/features/returns/services/attachmentFiles': helpers,
    '@/services/http/apiClient': {
      apiRequest: async (_, next) => {
        calls++;
        options = next;
        return { id: 9 };
      },
    },
  });
  await service.createReturn(
    'jwt',
    { order_id: 1, order_item_id: 2, can_request_return: true, returnable_quantity: 1 },
    {
      quantity: '1',
      reason: 'DEFECTIVE',
      description: 'O produto não liga.',
      attachments: [selected],
    },
  );
  assert.equal(calls, 1);
  assert.equal(options.token, 'jwt');
  assert.equal(options.method, 'POST');
  assert.equal(options.timeoutMs, 120000);
  assert.ok(options.body instanceof Multipart);
});

/** Carrega o download real com ficheiros nativos observáveis, sem escrever dados privados no disco. */
async function downloader(request) {
  const removed = [];
  const opened = [];
  const copied = [];
  class LocalFile {
    constructor(_, name) {
      this.uri = name === undefined ? _ : `file:///cache/${name}`;
      this.exists = false;
      this.size = 1024;
    }
    create() {
      this.exists = true;
    }
    write(bytes) {
      this.bytes = Array.from(bytes);
    }
    delete() {
      this.exists = false;
      removed.push(this.uri);
    }
    async copy(target) {
      if (this.uri.includes('broken')) throw new Error('Falha ao ler o fornecedor.');
      target.exists = true;
      target.size = this.size;
      copied.push({ source: this.uri, destination: target.uri });
    }
    async canPreview() {
      return true;
    }
    async preview() {
      opened.push(this.uri);
    }
  }
  const service = await load('src/features/returns/services/returnAttachmentApi.js', {
    'expo-file-system': { File: LocalFile, Paths: { cache: 'cache' } },
    'expo-sharing': { isAvailableAsync: async () => true, shareAsync: async () => {} },
    'react-native': { Platform: { OS: 'android' } },
    '@/features/returns/services/attachmentFiles': await files(),
    '@/features/returns/services/returnsApi': {
      returnId: (id) => {
        if (!Number.isSafeInteger(id) || id < 1) throw new Error('Identificador inválido');
        return id;
      },
    },
    '@/services/http/apiClient': { apiRequest: request },
  });
  return { service, removed, opened, copied };
}

test('consulta privada usa endpoint fixo e JWT, ignora download_url e limpa só a cópia local', async () => {
  let call;
  const { service, removed, opened } = await downloader(async (path, options) => {
    call = { path, options };
    return new Uint8Array([1, 2, 3]).buffer;
  });
  const attachment = {
    id: 7,
    name: '../original.pdf',
    mime_type: 'application/pdf',
    size: 3,
    download_url: 'https://outside.test/file',
  };
  const copy = await service.downloadReturnAttachment('jwt', attachment);
  assert.equal(call.path, '/client/returns/attachments/7');
  assert.equal(call.options.token, 'jwt');
  assert.equal(call.options.responseType, 'arrayBuffer');
  assert.equal(copy.uri.includes('original'), false);
  await service.openAttachmentCopy(copy, attachment);
  assert.deepEqual(opened, [copy.uri]);
  service.removeAttachmentCopy(copy);
  service.removeAttachmentCopy(copy);
  assert.deepEqual(removed, [copy.uri]);
});

test('ficheiros inválidos e downloads não autorizados não são abertos', async () => {
  const forbidden = { status: 403, message: 'Sem acesso' };
  const { service, opened } = await downloader(async () => {
    throw forbidden;
  });
  await assert.rejects(
    service.downloadReturnAttachment('jwt', { id: 1, mime_type: 'application/pdf', size: 1 }),
    (error) => error === forbidden,
  );
  await assert.rejects(
    service.downloadReturnAttachment('jwt', { id: 1, mime_type: 'text/html' }),
    /tipo/,
  );
  assert.equal(opened.length, 0);
});

test('abertura tardia não apresenta ficheiros depois de abandonar a página', async () => {
  const { service, opened } = await downloader(async () => new Uint8Array([1]).buffer);
  const attachment = { id: 7, mime_type: 'application/pdf', size: 1 };
  const copy = await service.downloadReturnAttachment('jwt', attachment);
  await service.openAttachmentCopy(copy, attachment, () => false);
  assert.equal(opened.length, 0);
  service.removeAttachmentCopy(copy);
  const picked = await service.resolvePickedAttachments([{ ...selected, size: undefined }]);
  assert.equal(picked[0].size, 1024);
});

test('anexos da conversa usam endpoint próprio e rejeitam origens fora da lista', async () => {
  let path;
  let calls = 0;
  const { service } = await downloader(async (next) => {
    path = next;
    calls++;
    return new Uint8Array([1]).buffer;
  });
  const attachment = {
    id: 7,
    mime_type: 'application/pdf',
    size: 1,
    download_url: 'https://outside.test/file',
  };
  const copy = await service.downloadReturnAttachment('jwt', attachment, 'message');
  assert.equal(path, '/client/returns/message-attachments/7');
  service.removeAttachmentCopy(copy);
  for (const source of ['../messages', '__proto__', 'https://outside.test'])
    await assert.rejects(service.downloadReturnAttachment('jwt', attachment, source), /origem/);
  assert.equal(calls, 1);
});

/** Executa o serializador real instalado no SDK, em vez de simular o transporte multipart. */
async function expoMultipartConverter() {
  const source = await readFile('node_modules/expo/src/winter/fetch/convertFormData.ts', 'utf8');
  const context = vm.createContext({ Blob, TextEncoder, Uint8Array });
  const module = new vm.SourceTextModule(stripTypeScriptTypes(source), { context });
  await module.link(
    () =>
      new vm.SyntheticModule(
        ['blobToArrayBufferAsync'],
        function () {
          this.setExport('blobToArrayBufferAsync', (blob) => blob.arrayBuffer());
        },
        { context },
      ),
  );
  await module.evaluate();
  return module.namespace;
}

test('regressão SDK 58: o formato antigo com uri é rejeitado pelo serializador real do Expo', async () => {
  const converter = await expoMultipartConverter();
  const old = new Multipart();
  old.append('attachments[0]', { uri: selected.uri, name: selected.name, type: selected.mimeType });
  await assert.rejects(
    converter.convertFormDataAsync(old, 'test-boundary'),
    /Unsupported FormDataPart/,
  );
});

test('upload do ficheiro nativo é serializado pelo Expo com bytes nome e tipo corretos', async () => {
  const converter = await expoMultipartConverter();
  const helpers = await files();
  const body = helpers.attachmentFormData({ message: 'Seguem imagens.' }, [selected]);
  const encoded = await converter.convertFormDataAsync(body, 'test-boundary');
  const text = new TextDecoder().decode(encoded.body);
  assert.match(text, /name="message"/);
  assert.match(text, /Seguem imagens\./);
  assert.match(text, /filename="photo.jpg"/);
  assert.match(text, /image\/jpeg/);
  assert.match(text, /conteudo-do-ficheiro/);
});

test('ficheiro removido da cache é rejeitado antes de iniciar o upload', async () => {
  const helpers = await load(
    'src/features/returns/services/attachmentFiles.js',
    {
      'expo-file-system': {
        File: class {
          exists = false;
        },
      },
    },
    { FormData: Multipart },
  );
  assert.throws(
    () => helpers.attachmentFormData({ message: 'Segue foto.' }, [selected]),
    /selecione-o novamente/i,
  );
});

test('seleção Android copia content URI para a cache própria antes de entregar o anexo', async () => {
  const { service, copied, removed } = await downloader(async () => new ArrayBuffer(1));
  const original = { ...selected, uri: 'content://provider/documents/photo', size: 1024 };
  const prepared = await service.resolvePickedAttachments([original]);
  assert.equal(copied.length, 1);
  assert.equal(copied[0].source, original.uri);
  assert.match(prepared[0].uri, /^file:\/\/\/cache\/return-upload-/);
  assert.equal(prepared[0].name, original.name);
  assert.equal(prepared[0].size, 1024);
  // Uma limpeza só reconhece ficheiros que o módulo criou; o URI original permanece intocado.
  service.removePickedAttachment(original);
  assert.equal(removed.length, 0);
  service.removePickedAttachment(prepared[0]);
  service.removePickedAttachment(prepared[0]);
  assert.deepEqual(removed, [prepared[0].uri]);
});

test('falha ao preparar seleção remove apenas cópias próprias e conserva erros de validação', async () => {
  const { service, copied, removed } = await downloader(async () => new ArrayBuffer(1));
  await assert.rejects(
    service.resolvePickedAttachments([
      { ...selected, uri: 'content://provider/ok' },
      { ...selected, uri: 'content://provider/broken', name: 'other.jpg' },
    ]),
    /Não foi possível copiar/,
  );
  assert.equal(copied.length, 1);
  assert.deepEqual(removed, [copied[0].destination]);
  await assert.rejects(
    service.resolvePickedAttachments([{ ...selected, size: 11 * 1024 * 1024 }]),
    /10 MB/,
  );
  await assert.rejects(service.resolvePickedAttachments(Array(6).fill(selected)), /até 5/);
});

test('anexos de reclamações usam somente a rota privada própria, ignorando download_url', async () => {
  let call;
  const { service } = await downloader(async (path, options) => {
    call = { path, options };
    return new Uint8Array([1]).buffer;
  });
  const copy = await service.downloadReturnAttachment(
    'jwt',
    {
      id: 9,
      name: 'imagem.jpg',
      mime_type: 'image/jpeg',
      size: 1,
      download_url: 'https://outside.test/file',
    },
    'complaint',
  );
  assert.equal(call.path, '/client/complaints/attachments/9');
  assert.equal(call.options.token, 'jwt');
  service.removeAttachmentCopy(copy);
});
