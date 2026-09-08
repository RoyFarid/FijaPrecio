import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** organizationId de la request en curso. Requiere JwtAuthGuard. */
export const CurrentOrg = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.auth) throw new Error('CurrentOrg usado sin JwtAuthGuard');
    return req.auth.organizationId;
  },
);
