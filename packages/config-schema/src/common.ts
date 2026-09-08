import { z } from 'zod';
import { zCsv, zInt, zOptional, zSecret } from './parse-env.js';

/** Bloques reutilizables por varios servicios. */

export const nodeEnv = z.enum(['development', 'test', 'staging', 'production']).default('development');

export const logLevel = z
  .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
  .default('info');

export const database = z.object({
  DATABASE_URL: z.string().url().startsWith('postgres'),
});

export const redis = z.object({
  REDIS_URL: z.string().url().startsWith('redis'),
});

export const objectStorage = z.object({
  R2_ENDPOINT: z.string().url(),
  R2_REGION: z.string().default('auto'),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_PUBLIC_URL: zOptional(z.string().url()),
});

export const internalServices = z.object({
  INTERNAL_API_TOKEN: zSecret(32),
  SCRAPER_URL: z.string().url(),
  OCR_URL: z.string().url(),
});

export const observability = z.object({
  SENTRY_DSN: zOptional(z.string().url()),
  LOG_LEVEL: logLevel,
});

export const businessDefaults = z.object({
  DEFAULT_CURRENCY: z.string().length(3).default('PEN'),
  DEFAULT_LOCALE: z.string().default('es-PE'),
  DEFAULT_TIMEZONE: z.string().default('America/Lima'),
});

export const cors = z.object({
  CORS_ORIGINS: zCsv.default('http://localhost:3000'),
});

export const jwt = z.object({
  JWT_ACCESS_SECRET: zSecret(32),
  JWT_REFRESH_SECRET: zSecret(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
});

export const httpPort = (fallback: number) =>
  z.object({ PORT: zInt.optional(), HTTP_PORT: zInt.default(fallback) });
