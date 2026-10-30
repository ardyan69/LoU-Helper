// ESLint (flat config). Run: npm run lint
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'lib/i18n/*.js'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.webextensions }
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': ['error', { destructuring: 'all' }],
      'no-implicit-globals': 'error',
      'no-restricted-syntax': ['error', { selector: "CallExpression[callee.name='eval']", message: 'eval is not allowed in extensions (CSP)' }]
    }
  },
  // classic scripts that run in the game page / content script (not modules)
  {
    files: ['content.js', 'page-hook.js', 'lib/compat.js', 'lib/game-dom.js', 'lib/i18n/content-dict.js'],
    languageOptions: { sourceType: 'script', globals: { LOU_I18N: 'readonly' } },
    rules: { 'no-implicit-globals': 'off' }
  },
  // Node: tools, tests, config
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } }
  }
];
