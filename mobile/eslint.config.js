const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

/** 앱의 린트 — `expo lint`. 뿌리의 린트는 `mobile/` 을 안 본다 */
module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'scripts/reset-project.js']),
  expoConfig,
]);
