import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  live(): { status: 'ok'; ts: string } {
    return { status: 'ok', ts: new Date().toISOString() };
  }
}
