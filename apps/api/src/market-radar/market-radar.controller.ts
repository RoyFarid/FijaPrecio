import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  MarketPriceBatch,
  MarketRadarView,
} from '@fijaprecio/shared-types';
import {
  MarketRadarService,
  type MarketHistory,
  type RadarTarget,
} from './market-radar.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import {
  ingestMarketPricesSchema,
  radarQuerySchema,
  radarTargetsQuerySchema,
  type RadarQuery,
  type RadarTargetsQuery,
} from './dto.js';
import { Public } from '../auth/public.decorator.js';
import { InternalTokenGuard } from '../auth/internal-token.guard.js';
import { RlsSystem } from '../tenancy/rls-mode.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';

@Controller('products/:productId/market-radar')
export class MarketRadarController {
  constructor(private readonly radar: MarketRadarService) {}

  /** Precio de mercado del producto vs tu precio sugerido. */
  @Get()
  get(
    @CurrentOrg() orgId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query(new ZodBody(radarQuerySchema)) query: RadarQuery,
  ): Promise<MarketRadarView> {
    return this.radar.forProduct(orgId, productId, query.region);
  }

  /** Serie temporal para el gráfico de historial (ventana = `radar_history_days`). */
  @Get('history')
  history(
    @CurrentOrg() orgId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query(new ZodBody(radarQuerySchema)) query: RadarQuery,
  ): Promise<MarketHistory> {
    return this.radar.historyForProduct(orgId, productId, query.region);
  }
}

@Public()
@RlsSystem()
@UseGuards(InternalTokenGuard)
@Controller('internal')
export class InternalMarketRadarController {
  constructor(private readonly radar: MarketRadarService) {}

  @Get('radar-targets')
  targets(
    @Query(new ZodBody(radarTargetsQuerySchema)) query: RadarTargetsQuery,
  ): Promise<RadarTarget[]> {
    return this.radar.radarTargets(query.limit);
  }

  @Post('market-prices')
  @HttpCode(202)
  ingest(
    @Body(new ZodBody(ingestMarketPricesSchema)) dto: MarketPriceBatch,
  ): Promise<{ created: number }> {
    return this.radar.ingest(dto);
  }
}
