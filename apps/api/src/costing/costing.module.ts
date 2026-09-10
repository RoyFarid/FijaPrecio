import { Module } from '@nestjs/common';
import { CostingService } from './costing.service.js';
import { SensitivityService } from './sensitivity.service.js';
import { CostingController } from './costing.controller.js';

@Module({
  controllers: [CostingController],
  providers: [CostingService, SensitivityService],
  exports: [CostingService, SensitivityService],
})
export class CostingModule {}
