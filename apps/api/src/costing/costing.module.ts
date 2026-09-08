import { Module } from '@nestjs/common';
import { CostingService } from './costing.service.js';
import { CostingController } from './costing.controller.js';

@Module({
  controllers: [CostingController],
  providers: [CostingService],
  exports: [CostingService],
})
export class CostingModule {}
