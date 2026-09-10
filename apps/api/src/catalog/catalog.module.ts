import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { CatalogController, InternalCatalogController } from './catalog.controller.js';

@Module({
  controllers: [CatalogController, InternalCatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
