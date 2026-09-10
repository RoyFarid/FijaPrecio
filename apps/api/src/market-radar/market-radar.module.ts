import { Module } from '@nestjs/common';
import { CostingModule } from '../costing/costing.module.js';
import { MarketRadarService } from './market-radar.service.js';
import {
  InternalMarketRadarController,
  MarketRadarController,
} from './market-radar.controller.js';

@Module({
  imports: [CostingModule],
  controllers: [MarketRadarController, InternalMarketRadarController],
  providers: [MarketRadarService],
})
export class MarketRadarModule {}
