import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Preset de ESLint para el backend.
 *
 * Criterio: reglas que detectan errores reales, no reglas de estilo — del estilo
 * se ocupa Prettier, y solapar ambos produce conflictos y ruido.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.js', '**/*.mjs'] },

  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { process: 'readonly', console: 'readonly', Buffer: 'readonly' },
    },

    rules: {
      // --- Errores reales -----------------------------------------------
      '@typescript-eslint/no-floating-promises': 'off', // requiere type-check; se cubre con tsc
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'smart'],
      'no-return-await': 'error',
      'require-await': 'off',

      // --- Ruido de NestJS -----------------------------------------------
      // Los decoradores hacen que TypeScript no "vea" el uso de los parámetros
      // del constructor; desactivar esta regla evita falsos positivos masivos.
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  {
    // En las pruebas se fuerzan tipos a propósito para simular estados inválidos.
    files: ['test/**/*.ts', '**/*.spec.ts', '**/*.e2e-spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  {
    files: ['prisma/seed/**/*.ts'],
    rules: { 'no-console': 'off' },
  },

  prettier,
);
