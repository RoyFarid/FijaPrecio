import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppConfigService } from './app-config.service.js';
import type { BooleanConfigKey } from '@fijaprecio/shared-types';

export const REQUIRE_ENTITLEMENT_KEY = 'auth:entitlement';

/**
 * Exige que el plan de la organización tenga activo un entitlement booleano.
 *
 *   @UseGuards(EntitlementsGuard)
 *   @RequireEntitlement('scenario_simulator')
 *   @Post('scenarios') ...
 *
 * Los límites numéricos (cuotas) NO se validan aquí: requieren contar uso.
 */
export const RequireEntitlement = (
  key: BooleanConfigKey,
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_ENTITLEMENT_KEY, key);

@Injectable()
export class EntitlementsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: AppConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const key = this.reflector.getAllAndOverride<BooleanConfigKey | undefined>(
      REQUIRE_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!key) return true;

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.auth) throw new ForbiddenException('No autenticado');

    const enabled = await this.config.get(req.auth.organizationId, key);
    if (!enabled) {
      throw new ForbiddenException(`Tu plan no incluye esta función (${key})`);
    }
    return true;
  }
}
