import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module.js';
import { env } from './config/env.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { AppConfigModule } from './config/app-config.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProductsModule } from './products/products.module.js';
import { CostingModule } from './costing/costing.module.js';

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
    AppConfigModule,
    AuthModule,
    ProductsModule,
    CostingModule,
    HealthModule,
    // TODO: OrgModule, CatalogModule, PricingIntelligenceModule,
    //       ReceiptsModule, MarketRadarModule, ScenariosModule, ...
  ],
})
export class AppModule {}
