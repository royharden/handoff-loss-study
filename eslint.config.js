// ESLint flat config (PLAN.md M1). Never run yet: see docs/DEFERRED-VALIDATION.md (DV-M1-03).
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** Network and provider SDK modules that src/core must never import (PLAN.md M1 static acceptance). */
const NETWORK_AND_PROVIDER_MODULES = [
  '@anthropic-ai/sdk',
  'openai',
  'undici',
  'axios',
  'node-fetch',
  'http',
  'https',
  'http2',
  'net',
  'tls',
  'dgram',
  'dns',
  'node:http',
  'node:https',
  'node:http2',
  'node:net',
  'node:tls',
  'node:dgram',
  'node:dns',
  'node:child_process',
  'child_process',
];

/** Erasable TypeScript only (PLAN.md §11): no enum, namespace or parameter properties. */
const ERASABLE_ONLY = [
  { selector: 'TSEnumDeclaration', message: 'Use a zod enum or a union of string literals, not enum.' },
  { selector: 'TSModuleDeclaration[kind!="global"]', message: 'No namespaces (erasable TypeScript only).' },
  { selector: 'TSParameterProperty', message: 'No parameter properties (erasable TypeScript only).' },
];

export default tseslint.config(
  {
    ignores: ['node_modules/**', 'dist/**', 'viewer/dist/**', 'coverage/**', 'tasks/**', 'fixtures/**', 'results/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': ['error', ...ERASABLE_ONLY],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: NETWORK_AND_PROVIDER_MODULES.map((name) => ({
            name,
            message: 'src/core is pure: no network, process or provider SDK imports.',
          })),
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'src/core performs no network I/O.' },
        { name: 'WebSocket', message: 'src/core performs no network I/O.' },
        { name: 'XMLHttpRequest', message: 'src/core performs no network I/O.' },
      ],
    },
  },
);
