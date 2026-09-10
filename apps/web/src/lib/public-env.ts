/* eslint-disable no-restricted-syntax -- las NEXT_PUBLIC_* las inyecta Next en el
   bundle; el server ya las valida con Zod en src/env.ts al arrancar. Este módulo
   es client-safe (no importa @fijaprecio/config-schema). */

/** URL pública de la API core (mismo valor que `clientEnv.NEXT_PUBLIC_API_URL`). */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export const PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'development';
