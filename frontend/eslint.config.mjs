// ESLint 9 flat config (eslint-config-next 16 requires ESLint >= 9). Same rule set as the former .eslintrc.json:
// next/core-web-vitals + next/typescript (which includes the typescript-eslint recommended rules) + the project rule.
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { vars: 'all', args: 'after-used', ignoreRestSiblings: true }],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'node_modules/**', 'next-env.d.ts']),
]);
