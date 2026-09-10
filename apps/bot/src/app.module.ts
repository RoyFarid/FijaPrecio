import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { env } from './config/env.js';
import { BotService } from './bot.service.js';
import { PrismaService } from './prisma.service.js';
import { QueueService } from './queue.service.js';
import { StorageService } from './storage.service.js';
import { HealthController } from './health.controller.js';
import { NotifyController } from './notify.controller.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
      },
    }),
  ],
  controllers: [HealthController, NotifyController],
  providers: [PrismaService, QueueService, StorageService, BotService],
})
export class AppModule {}
