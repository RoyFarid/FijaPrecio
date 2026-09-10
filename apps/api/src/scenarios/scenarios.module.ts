import { Module } from '@nestjs/common';
import { CostingModule } from '../costing/costing.module.js';
import { ScenariosService } from './scenarios.service.js';
import {
  ProductScenariosController,
  ScenariosController,
} from './scenarios.controller.js';

@Module({
  imports: [CostingModule],
  controllers: [ProductScenariosController, ScenariosController],
  providers: [ScenariosService],
})
export class ScenariosModule {}
