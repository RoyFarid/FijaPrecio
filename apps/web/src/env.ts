/* eslint-disable no-restricted-syntax -- este es el único punto donde `web` lee process.env */
import { webClientEnvSchema, webServerEnvSchema } from '@fijaprecio/config-schema';

/**
 * Validación de entorno del `web`.
 *  - `serverEnv`: solo disponible en el servidor.
 *  - `clientEnv`: SOLO NEXT_PUBLIC_* — se referencian explícitamente para que
 *    Next las inyecte en el bundle del cliente.
 * Falla el build/arranque si algo falta.
 */
export const serverEnv = webServerEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
});

export const clientEnv = webClientEnvSchema.parse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});
