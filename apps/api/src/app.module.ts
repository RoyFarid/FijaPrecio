import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module.js';
import { env } from './config/env.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { QueueModule } from './queue/queue.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { ProductsModule } from './products/products.module.js';
import { CostingModule } from './costing/costing.module.js';
import { ScenariosModule } from './scenarios/scenarios.module.js';
import { PriceObservationsModule } from './price-observations/price-observations.module.js';
import { TelegramModule } from './telegram/telegram.module.js';
import { ReceiptsModule } from './receipts/receipts.module.js';
import { MarketRadarModule } from './market-radar/market-radar.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport:
          env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    ConfigModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    AppConfigModule,
    AuthModule,
    CatalogModule,
    ProductsModule,
    CostingModule,
    ScenariosModule,
    MarketRadarModule,
    PriceObservationsModule,
    TelegramModule,
    ReceiptsModule,
    AlertsModule,
    NotificationsModule,
    HealthModule,
    // TODO: OrgModule, CatalogModule, PricingIntelligenceModule,
    //       ReceiptsModule, MarketRadarModule, ...
  ],
})
export class AppModule {}
