import { Module } from '@nestjs/common';
import { ProductCategoriesService } from './product-categories.service.js';
import { ProductCategoriesController } from './product-categories.controller.js';

@Module({
  controllers: [ProductCategoriesController],
  providers: [ProductCategoriesService],
  exports: [ProductCategoriesService],
})
export class ProductCategoriesModule {}
