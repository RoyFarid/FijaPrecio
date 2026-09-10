import { createStorage, type Storage } from '@fijaprecio/storage';
import { env } from './config/env.js';

export const storage: Storage = createStorage({
  endpoint: env.R2_ENDPOINT,
  region: env.R2_REGION,
  accessKeyId: env.R2_ACCESS_KEY_ID,
  secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  bucket: env.R2_BUCKET,
});
