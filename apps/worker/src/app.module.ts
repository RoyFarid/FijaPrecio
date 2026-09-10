import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { env } from './config/env.js';
import { PrismaService } from './prisma.js';
import { HealthController } from './health.controller.js';
import { ConsensusService } from './consensus/consensus.service.js';
import { ConsensusProcessor } from './consensus/consensus.processor.js';
import { OcrService } from './ocr/ocr.service.js';
import { OcrProcessor } from './ocr/ocr.processor.js';
import { AlertsProcessor } from './alerts/alerts.processor.js';
import { NotificationsService } from './notifications/notifications.service.js';
import { NotificationsProcessor } from './notifications/notifications.processor.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
  ],
  controllers: [HealthController],
  providers: [
    PrismaService,
    ConsensusService,
    ConsensusProcessor,
    OcrService,
    OcrProcessor,
    AlertsProcessor,
    NotificationsService,
    NotificationsProcessor,
    // TODO: ScrapeOnDemandProcessor, PdfExportProcessor
  ],
})
export class AppModule {}
