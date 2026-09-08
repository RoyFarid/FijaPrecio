import { Global, Module } from '@nestjs/common';
import { env } from './env.js';

export const ENV = Symbol('ENV');

/**
 * Expone la configuración validada por DI: `@Inject(ENV) private env: Env`.
 * Global => disponible en toda la app sin re-importar.
 */
@Global()
@Module({
  providers: [{ provide: ENV, useValue: env }],
  exports: [ENV],
})
export class ConfigModule {}
