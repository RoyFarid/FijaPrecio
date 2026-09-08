import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { CostingResult } from '@fijaprecio/shared-types';
import { CostingService } from './costing.service.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';

@Controller('products/:productId/costing')
export class CostingController {
  constructor(private readonly costing: CostingService) {}

  /** Costeo de la receta activa (en vivo, sin persistir). */
  @Get()
  compute(
    @CurrentOrg() orgId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<CostingResult> {
    return this.costing.computeForProduct(orgId, productId);
  }

  /** Guarda un CostingSnapshot auditable y lo devuelve. */
  @Post('snapshots')
  @HttpCode(201)
  snapshot(
    @CurrentOrg() orgId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ): Promise<CostingResult & { id: string }> {
    return this.costing.snapshotForProduct(orgId, productId);
  }
}
