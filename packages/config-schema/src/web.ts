import { z } from 'zod';
import { zOptional } from './parse-env.js';

/**
 * Esquema del `web` (Next.js).
 *  - server: variables solo de servidor (SSR / route handlers).
 *  - client: SOLO variables NEXT_PUBLIC_* (se inyectan al bundle del navegador).
 * Se validan en apps/web/src/env.ts al iniciar el server de Next.
 */
export const webServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // URL interna de la API para SSR (en Railway: red privada).
  API_INTERNAL_URL: zOptional(z.string().url()),
});

export const webClientEnvSchema = z.object({
  // default de desarrollo para que `next build` funcione sin .env;
  // en staging/production se define explícitamente en Railway.
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3001'),
  NEXT_PUBLIC_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_SENTRY_DSN: zOptional(z.string().url()),
});

export type WebServerEnv = z.infer<typeof webServerEnvSchema>;
export type WebClientEnv = z.infer<typeof webClientEnvSchema>;
