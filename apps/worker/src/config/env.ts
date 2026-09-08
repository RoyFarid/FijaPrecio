import { parseEnv, workerEnvSchema } from '@fijaprecio/config-schema';

export const env = parseEnv(workerEnvSchema);
export type Env = typeof env;
