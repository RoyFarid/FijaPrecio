import { SetMetadata } from '@nestjs/common';

export const RLS_SYSTEM_KEY = 'rls:system';

/**
 * Marca un controlador/handler como "de sistema" (endpoints internos,
 * `X-Internal-Token`, auth). **Informativo**: hoy nada lo lee — al no haber JWT,
 * `OrgContextMiddleware` deja la request sin contexto y la extensión Prisma ya
 * corre esas queries como `system` (`app.bypass_rls`). Se mantiene el decorador
 * para documentar la intención en el controlador.
 */
export const RlsSystem = (): MethodDecorator & ClassDecorator =>
  SetMetadata(RLS_SYSTEM_KEY, true);
