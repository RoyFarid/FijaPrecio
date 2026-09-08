import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Config base compartida (ESLint 9 flat config).
 * Cada app hace: `export { default } from '@fijaprecio/eslint-config';`
 * y añade sus overrides.
 */
export default tseslint.config(
  { ignores: ['dist/**', '.next/**', 'coverage/**', 'node_modules/**', '**/generated/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      // El "cero hardcodeo" también se vigila con lint:
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']:not([property.name=/^NODE_ENV$/])",
          message:
            'No leas process.env directo. Usa @fijaprecio/config-schema (validado con Zod al arranque).',
        },
      ],
    },
  },
  prettier,
);
