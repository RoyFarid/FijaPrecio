import { Redis } from 'ioredis';
import { env } from './config/env.js';

/** Conexión compartida para BullMQ (requiere maxRetriesPerRequest: null). */
export function createRedisConnection(): Redis {
  return new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
}
