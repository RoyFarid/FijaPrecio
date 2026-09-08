/**
 * Entorno mínimo válido para los tests: `@fijaprecio/config-schema` valida
 * `process.env` al importarse y aborta el proceso si falta algo. Solo rellena
 * las claves que no estén ya definidas (no pisa un `.env` real si lo hubiera).
 */
const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  API_PUBLIC_URL: 'http://localhost:3001',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test?schema=public',
  REDIS_URL: 'redis://localhost:6379',
  R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
  R2_ACCESS_KEY_ID: 'test',
  R2_SECRET_ACCESS_KEY: 'test',
  R2_BUCKET: 'test',
  INTERNAL_API_TOKEN: 'test-internal-token-with-min-32-characters',
  SCRAPER_URL: 'http://localhost:8000',
  OCR_URL: 'http://localhost:8001',
  JWT_ACCESS_SECRET: 'test-access-secret-with-min-32-characters',
  JWT_REFRESH_SECRET: 'test-refresh-secret-with-min-32-characters',
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}
