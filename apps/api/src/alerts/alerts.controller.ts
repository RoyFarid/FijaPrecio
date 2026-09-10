import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createAlertSchema,
  updateAlertSchema,
  type CreateAlertInput,
  type UpdateAlertInput,
} from '@fijaprecio/shared-types';
import { AlertsService } from './alerts.service.js';
import { AlertsEvaluatorService } from './alerts-evaluator.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { Public } from '../auth/public.decorator.js';
import { InternalTokenGuard } from '../auth/internal-token.guard.js';
import { RlsSystem } from '../tenancy/rls-mode.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';
import { CurrentUser } from '../auth/current-user.decorator.js';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.alerts.list(orgId);
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodBody(createAlertSchema)) dto: CreateAlertInput,
  ) {
    return this.alerts.create(orgId, userId, dto);
  }

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(updateAlertSchema)) dto: UpdateAlertInput,
  ) {
    return this.alerts.update(orgId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentOrg() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.alerts.remove(orgId, id);
  }
}

@Public()
@RlsSystem()
@UseGuards(InternalTokenGuard)
@Controller('internal/alerts')
export class InternalAlertsController {
  constructor(private readonly evaluator: AlertsEvaluatorService) {}

  /** Lo dispara el worker según `alerts.check_cron`. */
  @Post('run')
  @HttpCode(200)
  run(): Promise<{ checked: number; triggered: number; notifications: number }> {
    return this.evaluator.runAll();
  }
}
