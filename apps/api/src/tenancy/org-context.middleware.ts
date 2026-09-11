import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TokenService } from '../auth/token.service.js';
import { ACCESS_COOKIE } from '../auth/cookies.js';
import { orgContextStorage, type OrgContext } from './org-context.js';

/**
 * Abre el `AsyncLocalStorage` de tenant para TODA la request (`run`, no
 * `enterWith`): un middleware envuelve `next()`, así el contexto llega intacto a
 * guards, interceptores, handler y servicios. (El `enterWith` desde un guard NO
 * se propaga de forma fiable — de ahí este middleware.)
 *
 *   - JWT válido  → `{ mode: 'tenant', organizationId, ... }` + `req.auth`
 *   - sin token / token inválido → sin contexto: la extensión Prisma trata las
 *     queries como `system` (`app.bypass_rls`). El `JwtAuthGuard` responde 401
 *     antes de tocar la DB en rutas protegidas; las rutas internas/auth usan
 *     `PrismaService.asSystem` explícito donde escriben.
 */
@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  constructor(private readonly tokens: TokenService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = this.extractToken(req);
    let ctx: OrgContext | undefined;

    if (token) {
      try {
        const claims = await this.tokens.verifyAccessToken(token);
        req.auth = {
          userId: claims.sub,
          organizationId: claims.org,
          role: claims.role,
        };
        ctx = {
          mode: 'tenant',
          userId: claims.sub,
          organizationId: claims.org,
          role: claims.role,
        };
      } catch {
        ctx = undefined;
      }
    }

    if (ctx) {
      orgContextStorage.run(ctx, () => next());
    } else {
      next();
    }
  }

  private extractToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[ACCESS_COOKIE];
  }
}
