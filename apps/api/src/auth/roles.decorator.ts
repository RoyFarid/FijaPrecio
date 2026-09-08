import { SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '@fijaprecio/db';

export const ROLES_KEY = 'auth:roles';

/** Restringe el handler a los roles indicados (OWNER siempre pasa). */
export const Roles = (...roles: MembershipRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
