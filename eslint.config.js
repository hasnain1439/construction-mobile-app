const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', 'src/db/migrations/*', 'src/api/schema.ts', '.expo/*'] },
  { rules: { 'no-console': ['warn', { allow: ['warn', 'error'] }] } },
]);
