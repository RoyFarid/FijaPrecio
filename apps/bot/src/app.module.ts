import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { env } from './config/env.js';
import { BotService } from './bot.service.js';
import { HealthController } from './health.controller.js';

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
  providers: [BotService],
})
export class AppModule {}
