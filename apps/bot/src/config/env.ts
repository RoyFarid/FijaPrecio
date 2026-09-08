import { botEnvSchema, parseEnv } from '@fijaprecio/config-schema';

export const env = parseEnv(botEnvSchema);
export type Env = typeof env;
