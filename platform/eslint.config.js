import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.config.*'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
    },
  },
  {
    files: ['apps/api/**/*.ts', 'packages/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // Build scripts (Node).
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  {
    // Playwright journeys run in Node and drive a browser.
    files: ['e2e/**/*.mjs'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: { 'no-console': 'off' },
  },
  {
    // Small static pages' scripts in public/ (e.g. privacy.js).
    files: ['apps/*/public/**/*.js'],
    ignores: ['apps/*/public/sw.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
  {
    // Service workers are plain JS served as-is from public/.
    files: ['apps/*/public/sw.js'],
    languageOptions: { globals: globals.serviceworker, sourceType: 'script' },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
  {
    files: ['apps/customer/**/*.{ts,tsx}', 'apps/vendor/**/*.{ts,tsx}', 'packages/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // Raw HTML injection is how XSS gets in. React escapes everything else.
      'no-restricted-syntax': [
        'error',
        { selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']", message: 'Do not inject raw HTML.' },
        {
          // React calls whatever an effect returns as its cleanup. A value from a browser API
          // (which in-app browsers sometimes patch) crashed the live app: "l is not a function".
          selector:
            "CallExpression[callee.name=/^use(Layout|Insertion)?Effect$/] > ArrowFunctionExpression[expression=true][body.type!='ArrowFunctionExpression']",
          message: 'Give effects a block body: useEffect(() => { … }). Only return a cleanup function.',
        },
      ],
    },
  },
);
