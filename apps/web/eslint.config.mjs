import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';
import base from '@fijaprecio/eslint-config';

/**
 * Flat config del `web`. Reusa la base del monorepo + las reglas de Next
 * (`eslint-config-next` sólo trae formato eslintrc → se traduce con FlatCompat).
 * Reemplaza a `next lint` (deprecado en Next 16).
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [
  { ignores: ['.next/**', 'next-env.d.ts'] },
  ...base,
  ...compat.extends('next/core-web-vitals'),
];
