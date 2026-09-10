import { defineConfig } from 'vitest/config';

/** Tests unitarios de la lógica pura de `src/lib/` (sin DOM ni Next). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
