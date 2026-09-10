import { Module } from '@nestjs/common';
import { CostingModule } from '../costing/costing.module.js';
import { AlertsService } from './alerts.service.js';
import { AlertsEvaluatorService } from './alerts-evaluator.service.js';
import { AlertsController, InternalAlertsController } from './alerts.controller.js';

@Module({
  imports: [CostingModule],
  controllers: [AlertsController, InternalAlertsController],
  providers: [AlertsService, AlertsEvaluatorService],
})
export class AlertsModule {}
