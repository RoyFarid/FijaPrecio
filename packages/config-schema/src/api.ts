import { z } from 'zod';
import { zInt, zOptional } from './parse-env.js';
import {
  businessDefaults,
  cors,
  database,
  internalServices,
  jwt,
  nodeEnv,
  objectStorage,
  observability,
  redis,
} from './common.js';

/** Esquema de entorno del servicio `api` (NestJS HTTP). */
export const apiEnvSchema = z
  .object({
    NODE_ENV: nodeEnv,
    // Railway inyecta PORT; en local usamos API_PORT.
    PORT: zInt.optional(),
    API_PORT: zInt.default(3001),
    API_PUBLIC_URL: z.string().url(),

    TYPESENSE_URL: zOptional(z.string().url()),
    TYPESENSE_API_KEY: zOptional(z.string()),

    RESEND_API_KEY: zOptional(z.string()),
    EMAIL_FROM: z.string().default('FijaPrecio <no-reply@fijaprecio.local>'),

    TELEGRAM_BOT_TOKEN: zOptional(z.string()),

    // Dominio de la cookie de sesión (p. ej. ".fijaprecio.com" para compartir
    // entre app.* y api.*). Vacío en local => cookie de host.
    AUTH_COOKIE_DOMAIN: zOptional(z.string()),

    // TTL del caché Redis de configuración (AppSetting / PlanEntitlement).
    CONFIG_CACHE_TTL_SECONDS: zInt.default(300),
  })
  .merge(database)
  .merge(redis)
  .merge(objectStorage)
  .merge(internalServices)
  .merge(jwt)
  .merge(cors)
  .merge(observability)
  .merge(businessDefaults)
  .transform((c) => ({ ...c, port: c.PORT ?? c.API_PORT }));

export type ApiEnv = z.infer<typeof apiEnvSchema>;
