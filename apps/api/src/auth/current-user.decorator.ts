import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { RequestAuth } from './auth.types.js';

/** Devuelve la identidad de la request (o un campo suyo). Requiere JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (field: keyof RequestAuth | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.auth) throw new Error('CurrentUser usado sin JwtAuthGuard');
    return field ? req.auth[field] : req.auth;
  },
);
