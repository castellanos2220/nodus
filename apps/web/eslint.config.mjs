import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/**
 * ESLint del frontend.
 *
 * Se apoya en `next/core-web-vitals`, que ya incluye las reglas de React, de
 * hooks y de accesibilidad que importan aquí. Prettier gobierna el formato.
 */
export default [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },

  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),

  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
