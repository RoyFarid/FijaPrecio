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
import { orgContextStorage } from '../tenancy/org-context.js';
import { RLS_SYSTEM_KEY } from '../tenancy/rls-mode.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
    if (isPublic) {
      // Rutas internas / auth: corren en modo sistema para RLS (bypass).
      if (this.reflector.getAllAndOverride<boolean>(RLS_SYSTEM_KEY, targets)) {
        orgContextStorage.enterWith({ mode: 'system' });
      }
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw new UnauthorizedException('No autenticado');

    const claims = await this.tokens.verifyAccessToken(token);
    const auth: RequestAuth = {
      userId: claims.sub,
      organizationId: claims.org,
      role: claims.role,
    };
    req.auth = auth;

    // Abre el contexto de tenant para el resto de la ejecución de esta request.
    orgContextStorage.enterWith({
      mode: 'tenant',
      userId: auth.userId,
      organizationId: auth.organizationId,
      role: auth.role,
    });

    return true;
  }

  private extractToken(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.slice(7);
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[ACCESS_COOKIE];
  }
}
