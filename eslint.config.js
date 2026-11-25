const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  globalIgnores(['.expo/**', 'dist/**', 'node_modules/**']),
  expoConfig,
  prettierRecommended,
  {
    rules: {
      // O Metro resolve @/ pelo jsconfig; o resolver padrão do ESLint não.
      'import/no-unresolved': ['error', { ignore: ['^@/'] }],
    },
  },
]);
