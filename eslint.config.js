// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'dist/*',
      'node_modules/*',
      '.expo/*',
      'ios/*',
      'android/*',
      // Edge Functions run in Deno; linting them with Node's ESLint fails on
      // the jsr:/npm: import specifiers. Deno has its own linter for these.
      'supabase/functions/**/*',
    ],
  },
]);
