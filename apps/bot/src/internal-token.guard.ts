import { timingSafeEqual } from 'node:crypto';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { env } from './config/env.js';

interface HeaderCarrier {
  headers: Record<string, string | string[] | undefined>;
}

@Injectable()
export class InternalTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<HeaderCarrier>();
    const header = req.headers['x-internal-token'];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided || !safeEqual(provided, env.INTERNAL_API_TOKEN)) {
      throw new UnauthorizedException('Token interno inválido');
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
