import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './app-config.service.js';
import type { ConfigKey } from './config-keys.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';

@Controller('config')
export class AppConfigController {
  constructor(private readonly config: AppConfigService) {}

  /** Config de negocio efectiva para la organización de la sesión. */
  @Get()
  effective(@CurrentOrg() orgId: string): Promise<Record<ConfigKey, unknown>> {
    return this.config.effectiveConfig(orgId);
  }
}
