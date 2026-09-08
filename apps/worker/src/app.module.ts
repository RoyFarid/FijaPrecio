import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { env } from './config/env.js';
import { PrismaService } from './prisma.js';
import { HealthController } from './health.controller.js';
import { ConsensusProcessor } from './processors/consensus.processor.js';

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
    ConsensusProcessor,
    // TODO: OcrProcessor, ScrapeOnDemandProcessor, AlertsProcessor,
    //       NotificationsProcessor, PdfExportProcessor
  ],
})
export class AppModule {}
