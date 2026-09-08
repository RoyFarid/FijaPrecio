import { z } from 'zod';
import { zInt, zSecret } from './parse-env.js';
import {
  database,
  internalServices,
  nodeEnv,
  objectStorage,
  observability,
  redis,
} from './common.js';

/** Esquema del servicio `bot` (Telegram webhook + Telegraf). */
export const botEnvSchema = z
  .object({
    NODE_ENV: nodeEnv,
    PORT: zInt.optional(),
    BOT_PORT: zInt.default(3002),
    BOT_PUBLIC_URL: z.string().url(),

    TELEGRAM_BOT_TOKEN: z.string().min(20),
    TELEGRAM_WEBHOOK_SECRET: zSecret(16),
    // ruta secreta del webhook; si no se define se deriva del secret
    TELEGRAM_WEBHOOK_PATH: z.string().default('/telegram/webhook'),

    API_URL: z.string().url(),
  })
  .merge(database)
  .merge(redis)
  .merge(objectStorage)
  .merge(internalServices)
  .merge(observability)
  .transform((c) => ({ ...c, port: c.PORT ?? c.BOT_PORT }));

export type BotEnv = z.infer<typeof botEnvSchema>;
