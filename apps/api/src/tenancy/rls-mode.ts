import { SetMetadata } from '@nestjs/common';

export const RLS_SYSTEM_KEY = 'rls:system';

/**
 * Marca un controlador/handler como "de sistema": sus queries corren con
 * `app.bypass_rls = on` (no filtran por tenant). Para endpoints internos
 * (`X-Internal-Token`), crons, y el bootstrap de identidad (auth).
 *
 * Lo aplica `JwtAuthGuard` sobre rutas `@Public()`.
 */
export const RlsSystem = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RLS_SYSTEM_KEY, true);
