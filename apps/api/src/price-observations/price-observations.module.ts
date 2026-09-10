import { Module } from '@nestjs/common';
import { PriceObservationsService } from './price-observations.service.js';
import {
  InputConsensusController,
  InternalPriceObservationsController,
  InternalScrapeTargetsController,
  PriceObservationsController,
} from './price-observations.controller.js';

@Module({
  controllers: [
    PriceObservationsController,
    InternalPriceObservationsController,
    InternalScrapeTargetsController,
    InputConsensusController,
  ],
  providers: [PriceObservationsService],
  exports: [PriceObservationsService],
})
export class PriceObservationsModule {}
