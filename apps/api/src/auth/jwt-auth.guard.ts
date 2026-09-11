import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator.js';
import { ACCESS_COOKIE } from './cookies.js';
import { TokenService } from './token.service.js';
import type { RequestAuth } from './auth.types.js';

/**
 * Enforcement de sesión. El contexto RLS de tenant lo abre `OrgContextMiddleware`
 * (antes que este guard); aquí solo se rechaza si falta o es inválido el token.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();

    // OrgContextMiddleware ya validó el token y puso `req.auth` si es válido.
    if (req.auth) return true;

    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('No autenticado');

    const claims = await this.tokens.verifyAccessToken(token);
    const auth: RequestAuth = {
      userId: claims.sub,
      organizationId: claims.org,
      role: claims.role,
    };
    req.auth = auth;
    return true;
  }

  private extractToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[ACCESS_COOKIE];
  }
}
