import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisService } from '../redis/redis.service.js';
import { env } from './env.js';
import {
  CONFIG_SCHEMAS,
  type ConfigKey,
  type ConfigValue,
} from '@fijaprecio/shared-types';

type Bag = Record<string, unknown>;

const NS = 'cfg:v1';
const keys = {
  global: `${NS}:global`,
  orgOverrides: (orgId: string) => `${NS}:org:${orgId}:overrides`,
  orgPlan: (orgId: string) => `${NS}:org:${orgId}:plan`,
  planEntitlements: (planId: string) => `${NS}:plan:${planId}:entitlements`,
};

export class ConfigKeyMissingError extends Error {
  constructor(key: string) {
    super(
      `Config "${key}" no existe en ninguna capa (org / plan / global). ` +
        `Falta sembrarla en packages/db/prisma/seed.ts`,
    );
    this.name = 'ConfigKeyMissingError';
  }
}

export class ConfigKeyInvalidError extends Error {
  constructor(key: string, detail: string) {
    super(`Config "${key}" tiene un valor inválido en la base: ${detail}`);
    this.name = 'ConfigKeyInvalidError';
  }
}

/**
 * Acceso de runtime a los parámetros de negocio. Precedencia por clave:
 *
 *   1. AppSetting  scope=ORGANIZATION  (override de la org)
 *   2. PlanEntitlement del plan de la org
 *   3. AppSetting  scope=GLOBAL        (default del sistema)
 *
 * Cada capa se cachea como un blob en Redis (TTL = CONFIG_CACHE_TTL_SECONDS).
 * Si Redis no responde, se degrada a leer de Postgres directamente.
 */
@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly ttl = env.CONFIG_CACHE_TTL_SECONDS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Valor tipado y validado. Lanza si la clave no está sembrada o es inválida. */
  async get<K extends ConfigKey>(orgId: string, key: K): Promise<ConfigValue<K>> {
    const raw = await this.resolveRaw(orgId, key);
    if (raw === undefined) throw new ConfigKeyMissingError(key);
    return this.parse(key, raw);
  }

  async getOptional<K extends ConfigKey>(
    orgId: string,
    key: K,
  ): Promise<ConfigValue<K> | undefined> {
    const raw = await this.resolveRaw(orgId, key);
    return raw === undefined ? undefined : this.parse(key, raw);
  }

  /** Solo la capa global (sin org ni plan). Útil para crons y jobs sin tenant. */
  async getGlobal<K extends ConfigKey>(key: K): Promise<ConfigValue<K>> {
    const raw = (await this.globalSettings())[key];
    if (raw === undefined) throw new ConfigKeyMissingError(key);
    return this.parse(key, raw);
  }

  /** Config efectiva combinada (para el frontend / `configUsed` del costeo). */
  async effectiveConfig(orgId: string): Promise<Record<ConfigKey, unknown>> {
    const [glob, ent, org] = await Promise.all([
      this.globalSettings(),
      this.planEntitlements(orgId),
      this.orgOverrides(orgId),
    ]);
    const merged = { ...glob, ...ent, ...org };
    const out = {} as Record<ConfigKey, unknown>;
    for (const key of Object.keys(CONFIG_SCHEMAS) as ConfigKey[]) {
      if (key in merged) out[key] = merged[key];
    }
    return out;
  }

  async invalidateGlobal(): Promise<void> {
    await this.del(keys.global);
  }

  async invalidateOrg(orgId: string): Promise<void> {
    await this.del(keys.orgOverrides(orgId), keys.orgPlan(orgId));
  }

  async invalidatePlan(planId: string): Promise<void> {
    await this.del(keys.planEntitlements(planId));
  }

  // ---------------------------------------------------------------------------

  private async resolveRaw(orgId: string, key: ConfigKey): Promise<unknown> {
    const org = await this.orgOverrides(orgId);
    if (key in org) return org[key];
    const ent = await this.planEntitlements(orgId);
    if (key in ent) return ent[key];
    const glob = await this.globalSettings();
    return key in glob ? glob[key] : undefined;
  }

  private parse<K extends ConfigKey>(key: K, raw: unknown): ConfigValue<K> {
    const result = CONFIG_SCHEMAS[key].safeParse(raw);
    if (!result.success) {
      throw new ConfigKeyInvalidError(key, result.error.issues[0]?.message ?? 'desconocido');
    }
    return result.data as ConfigValue<K>;
  }

  private globalSettings(): Promise<Bag> {
    return this.cached(keys.global, async () => {
      const rows = await this.prisma.client.appSetting.findMany({
        where: { scope: 'GLOBAL' },
        select: { key: true, value: true },
      });
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    });
  }

  private orgOverrides(orgId: string): Promise<Bag> {
    return this.cached(keys.orgOverrides(orgId), async () => {
      const rows = await this.prisma.client.appSetting.findMany({
        where: { scope: 'ORGANIZATION', organizationId: orgId },
        select: { key: true, value: true },
      });
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    });
  }

  private async planEntitlements(orgId: string): Promise<Bag> {
    const planRef = await this.cached(keys.orgPlan(orgId), async () => {
      const sub = await this.prisma.client.subscription.findUnique({
        where: { organizationId: orgId },
        select: { planId: true },
      });
      const fallback = await this.prisma.client.plan.findUnique({
        where: { code: 'FREE' },
        select: { id: true },
      });
      return { planId: sub?.planId ?? fallback?.id ?? null };
    });

    const planId = planRef.planId;
    if (!planId) return {};

    return this.cached(keys.planEntitlements(planId), async () => {
      const rows = await this.prisma.client.planEntitlement.findMany({
        where: { planId },
        select: { key: true, value: true },
      });
      return Object.fromEntries(rows.map((r) => [r.key, r.value]));
    });
  }

  private async cached<T>(cacheKey: string, loader: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.redis.client.get(cacheKey);
      if (hit !== null) return JSON.parse(hit) as T;
    } catch (err) {
      this.logger.warn(`Redis GET ${cacheKey} falló: ${(err as Error).message}`);
    }

    const value = await loader();

    try {
      await this.redis.client.set(cacheKey, JSON.stringify(value), 'EX', this.ttl);
    } catch (err) {
      this.logger.warn(`Redis SET ${cacheKey} falló: ${(err as Error).message}`);
    }
    return value;
  }

  private async del(...cacheKeys: string[]): Promise<void> {
    try {
      await this.redis.client.del(...cacheKeys);
    } catch (err) {
      this.logger.warn(`Redis DEL falló: ${(err as Error).message}`);
    }
  }
}
