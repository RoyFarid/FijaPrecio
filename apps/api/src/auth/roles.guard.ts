import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { MembershipRole } from '@fijaprecio/db';
import { ROLES_KEY } from './roles.decorator.js';

/** Jerarquía: OWNER > ADMIN > MEMBER. */
const RANK: Record<MembershipRole, number> = { OWNER: 3, ADMIN: 2, MEMBER: 1 };

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<MembershipRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const role = req.auth?.role;
    if (!role) throw new ForbiddenException('Sin rol en la organización');

    const minRequired = Math.min(...required.map((r) => RANK[r]));
    if (RANK[role] < minRequired) {
      throw new ForbiddenException('Permisos insuficientes');
    }
    return true;
  }
}
