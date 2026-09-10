import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type {
  ScenarioComparison,
  SavedScenario,
} from '@fijaprecio/shared-types';
import { ScenariosService } from './scenarios.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import {
  compareScenariosSchema,
  createScenarioSchema,
  type CompareScenariosInput,
  type CreateScenarioInput,
} from './dto.js';
import { EntitlementsGuard, RequireEntitlement } from '../config/entitlements.guard.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@UseGuards(EntitlementsGuard)
@RequireEntitlement('scenario_simulator')
@Controller('products/:productId/scenarios')
export class ProductScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  /** Tabla comparativa ad-hoc (no persiste). */
  @Post('compare')
  @HttpCode(200)
  compare(
    @CurrentOrg() orgId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body(new ZodBody(compareScenariosSchema)) dto: CompareScenariosInput,
  ): Promise<ScenarioComparison> {
    return this.scenarios.compare(orgId, productId, dto);
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body(new ZodBody(createScenarioSchema)) dto: CreateScenarioInput,
  ): Promise<SavedScenario> {
    return this.scenarios.create(orgId, userId, productId, dto);
  }

  @Get()
  list(
    @CurrentOrg() orgId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<SavedScenario[]> {
    return this.scenarios.list(orgId, productId);
  }
}

@UseGuards(EntitlementsGuard)
@RequireEntitlement('scenario_simulator')
@Controller('scenarios')
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Get(':id')
  get(
    @CurrentOrg() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SavedScenario> {
    return this.scenarios.get(orgId, id);
  }

  @Post(':id/recompute')
  @HttpCode(200)
  recompute(
    @CurrentOrg() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SavedScenario> {
    return this.scenarios.recompute(orgId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentOrg() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.scenarios.remove(orgId, id);
  }
}
