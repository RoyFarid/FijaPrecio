import { z } from 'zod';
import { zInt, zOptional } from './parse-env.js';
import {
  businessDefaults,
  database,
  internalServices,
  nodeEnv,
  objectStorage,
  observability,
  redis,
} from './common.js';

/**
 * Esquema del servicio `worker` (procesadores BullMQ, sin HTTP salvo /health).
 * Comparte Redis y DB con `api`. No necesita JWT ni CORS.
 */
export const workerEnvSchema = z
  .object({
    NODE_ENV: nodeEnv,
    PORT: zInt.optional(),
    WORKER_HEALTH_PORT: zInt.default(3010),
    WORKER_CONCURRENCY: zInt.default(5),

    // Cada cuánto el worker barre y re-encola recálculos de consenso.
    CONSENSUS_SWEEP_INTERVAL_MINUTES: zInt.default(30),
    // Cada cuánto el worker envía las notificaciones PENDING.
    NOTIFICATIONS_POLL_MINUTES: zInt.default(2),

    // API core (para /internal/catalog/match y /internal/receipts/:id/confirm)
    API_URL: z.string().url(),
    // Bot (para notificar el resumen de una boleta parseada). Opcional en local.
    BOT_INTERNAL_URL: zOptional(z.string().url()),

    RESEND_API_KEY: zOptional(z.string()),
    EMAIL_FROM: z.string().default('FijaPrecio <no-reply@fijaprecio.local>'),
  })
  .merge(database)
  .merge(redis)
  .merge(objectStorage)
  .merge(internalServices)
  .merge(observability)
  .merge(businessDefaults)
  .transform((c) => ({ ...c, healthPort: c.PORT ?? c.WORKER_HEALTH_PORT }));

export type WorkerEnv = z.infer<typeof workerEnvSchema>;
