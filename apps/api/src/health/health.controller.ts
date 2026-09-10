import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { Public } from '../auth/public.decorator.js';
import { RlsSystem } from '../tenancy/rls-mode.js';

@Public()
@RlsSystem()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: el proceso responde. */
  @Get()
  live(): { status: 'ok'; ts: string } {
    return { status: 'ok', ts: new Date().toISOString() };
  }

  /** Readiness: dependencias críticas alcanzables. */
  @Get('ready')
  async ready(): Promise<{ status: string; checks: Record<string, 'up' | 'down'> }> {
    const [database, redis] = await Promise.all([
      this.check(() => this.prisma.client.$queryRaw`SELECT 1`),
      this.check(() => this.redis.client.ping()),
    ]);
    const checks = { database, redis };
    const ok = Object.values(checks).every((v) => v === 'up');
    return { status: ok ? 'ready' : 'degraded', checks };
  }

  private async check(probe: () => Promise<unknown>): Promise<'up' | 'down'> {
    try {
      await probe();
      return 'up';
    } catch {
      return 'down';
    }
  }
}
