const { readFile } = require('node:fs/promises');
const vm = require('node:vm');

/** Carrega módulos da aplicação com dependências simuladas num contexto isolado. */
async function load(path, dependencies = {}, globals = {}) {
  const context = vm.createContext({ setTimeout, clearTimeout, AbortController, ...globals });
  const source = await readFile(path, 'utf8');
  const module = new vm.SourceTextModule(source, { context });
  await module.link((name) => {
    const values = dependencies[name];
    return new vm.SyntheticModule(
      Object.keys(values),
      function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      },
      { context },
    );
  });
  await module.evaluate();
  return module.namespace;
}

module.exports = { load };
