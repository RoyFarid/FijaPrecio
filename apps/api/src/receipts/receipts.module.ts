import { Module } from '@nestjs/common';
import { ReceiptsService } from './receipts.service.js';
import { InternalReceiptsController } from './receipts.controller.js';

@Module({
  controllers: [InternalReceiptsController],
  providers: [ReceiptsService],
})
export class ReceiptsModule {}
