import { apiEnvSchema, parseEnv } from '@fijaprecio/config-schema';

/**
 * Configuración del servicio `api`, validada al importar este módulo.
 * Si falta o es inválida una variable requerida => el proceso ABORTA aquí.
 * En ningún otro punto de `api` se lee `process.env`.
 */
export const env = parseEnv(apiEnvSchema);
export type Env = typeof env;

export const isProd = env.NODE_ENV === 'production';
