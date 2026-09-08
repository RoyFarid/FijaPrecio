import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service.js';
import { AppConfigController } from './app-config.controller.js';
import { EntitlementsGuard } from './entitlements.guard.js';

@Global()
@Module({
  controllers: [AppConfigController],
  providers: [AppConfigService, EntitlementsGuard],
  exports: [AppConfigService, EntitlementsGuard],
})
export class AppConfigModule {}
