import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  PriceConsensusView,
  PriceObservationBatch,
} from '@fijaprecio/shared-types';
import { PriceObservationsService } from './price-observations.service.js';
import {
  consensusQuerySchema,
  ingestBatchSchema,
  manualObservationSchema,
  scrapeTargetsQuerySchema,
  type ConsensusQuery,
  type ManualObservationInput,
  type ScrapeTarget,
  type ScrapeTargetsQuery,
} from './dto.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { Public } from '../auth/public.decorator.js';
import { InternalTokenGuard } from '../auth/internal-token.guard.js';
import { RlsSystem } from '../tenancy/rls-mode.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('price-observations')
export class PriceObservationsController {
  constructor(private readonly service: PriceObservationsService) {}

  /** Aporte manual del usuario. */
  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodBody(manualObservationSchema)) dto: ManualObservationInput,
  ): Promise<{ id: string }> {
    return this.service.createManual(orgId, userId, dto);
  }
}

@Public()
@RlsSystem()
@UseGuards(InternalTokenGuard)
@Controller('internal/price-observations')
export class InternalPriceObservationsController {
  constructor(private readonly service: PriceObservationsService) {}

  /** Ingesta batch servicio-a-servicio (scraper / gov / OCR). */
  @Post()
  @HttpCode(202)
  ingest(
    @Body(new ZodBody(ingestBatchSchema)) dto: PriceObservationBatch,
  ): Promise<{ created: number }> {
    return this.service.ingestBatch(dto);
  }
}

@Public()
@RlsSystem()
@UseGuards(InternalTokenGuard)
@Controller('internal/scrape-targets')
export class InternalScrapeTargetsController {
  constructor(private readonly service: PriceObservationsService) {}

  /** Insumos canónicos que conviene raspar (usados por alguna org, consenso más viejo primero). */
  @Get()
  list(
    @Query(new ZodBody(scrapeTargetsQuerySchema)) query: ScrapeTargetsQuery,
  ): Promise<ScrapeTarget[]> {
    return this.service.scrapeTargets(query.limit);
  }
}

@Controller('inputs/:canonicalInputId/consensus')
export class InputConsensusController {
  constructor(private readonly service: PriceObservationsService) {}

  @Get()
  async get(
    @Param('canonicalInputId', ParseUUIDPipe) canonicalInputId: string,
    @Query(new ZodBody(consensusQuerySchema)) query: ConsensusQuery,
  ): Promise<PriceConsensusView> {
    const consensus = await this.service.getConsensus(
      canonicalInputId,
      query.region,
      query.currency,
    );
    if (!consensus) throw new NotFoundException('Aún no hay consenso para ese insumo/región');
    return consensus;
  }
}
