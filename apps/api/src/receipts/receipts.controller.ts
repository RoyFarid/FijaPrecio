import { Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ReceiptsService } from './receipts.service.js';
import { Public } from '../auth/public.decorator.js';
import { InternalTokenGuard } from '../auth/internal-token.guard.js';
import { RlsSystem } from '../tenancy/rls-mode.js';

@Public()
@RlsSystem()
@UseGuards(InternalTokenGuard)
@Controller('internal/receipts')
export class InternalReceiptsController {
  constructor(private readonly receipts: ReceiptsService) {}

  /** El bot llama aquí cuando el usuario confirma el resumen de la boleta. */
  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@Param('id', ParseUUIDPipe) id: string): Promise<{ created: number }> {
    return this.receipts.confirm(id);
  }
}
