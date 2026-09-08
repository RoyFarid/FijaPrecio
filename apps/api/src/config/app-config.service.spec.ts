import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger } from '@nestjs/common';
import {
  AppConfigService,
  ConfigKeyInvalidError,
  ConfigKeyMissingError,
} from './app-config.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { RedisService } from '../redis/redis.service.js';

type Row = { key: string; value: unknown };

interface FakeData {
  global?: Row[];
  orgOverrides?: Record<string, Row[]>;
  entitlements?: Record<string, Row[]>; // planId -> rows
  subscriptions?: Record<string, string>; // orgId -> planId
  freePlanId?: string;
}

function fakePrisma(data: FakeData) {
  const calls = { appSetting: 0, subscription: 0, planEntitlement: 0 };
  const client = {
    appSetting: {
      findMany: vi.fn(async (args: { where: { scope: string; organizationId?: string } }) => {
        calls.appSetting++;
        if (args.where.scope === 'GLOBAL') return data.global ?? [];
        return data.orgOverrides?.[args.where.organizationId ?? ''] ?? [];
      }),
    },
    subscription: {
      findUnique: vi.fn(async (args: { where: { organizationId: string } }) => {
        calls.subscription++;
        const planId = data.subscriptions?.[args.where.organizationId];
        return planId ? { planId } : null;
      }),
    },
    plan: {
      findUnique: vi.fn(async () => (data.freePlanId ? { id: data.freePlanId } : null)),
    },
    planEntitlement: {
      findMany: vi.fn(async (args: { where: { planId: string } }) => {
        calls.planEntitlement++;
        return data.entitlements?.[args.where.planId] ?? [];
      }),
    },
  };
  return { service: { client } as unknown as PrismaService, calls };
}

function fakeRedis(opts: { broken?: boolean } = {}) {
  const store = new Map<string, string>();
  const boom = () => {
    throw new Error('ECONNREFUSED');
  };
  const client = {
    get: vi.fn(async (k: string) => {
      if (opts.broken) boom();
      return store.get(k) ?? null;
    }),
    set: vi.fn(async (k: string, v: string) => {
      if (opts.broken) boom();
      store.set(k, v);
      return 'OK';
    }),
    del: vi.fn(async (...ks: string[]) => {
      ks.forEach((k) => store.delete(k));
      return ks.length;
    }),
  };
  return { service: { client } as unknown as RedisService, store };
}

const ORG = 'org-1';
const PLAN = 'plan-free';

describe('AppConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  it('usa la capa global cuando no hay override ni plan', async () => {
    const { service: prisma } = fakePrisma({ global: [{ key: 'tax.igv_rate', value: 0.18 }] });
    const { service: redis } = fakeRedis();
    const cfg = new AppConfigService(prisma, redis);

    await expect(cfg.get(ORG, 'tax.igv_rate')).resolves.toBe(0.18);
  });

  it('el entitlement del plan gana a la global', async () => {
    const { service: prisma } = fakePrisma({
      global: [{ key: 'pdf_export', value: false }],
      subscriptions: { [ORG]: PLAN },
      entitlements: { [PLAN]: [{ key: 'pdf_export', value: true }] },
    });
    const cfg = new AppConfigService(prisma, fakeRedis().service);

    await expect(cfg.get(ORG, 'pdf_export')).resolves.toBe(true);
  });

  it('el override de la organización gana a todo', async () => {
    const { service: prisma } = fakePrisma({
      global: [{ key: 'costing.default_margin_pct', value: 0.3 }],
      subscriptions: { [ORG]: PLAN },
      entitlements: { [PLAN]: [] },
      orgOverrides: { [ORG]: [{ key: 'costing.default_margin_pct', value: 0.42 }] },
    });
    const cfg = new AppConfigService(prisma, fakeRedis().service);

    await expect(cfg.get(ORG, 'costing.default_margin_pct')).resolves.toBe(0.42);
  });

  it('lanza si la clave no está sembrada en ninguna capa', async () => {
    const { service: prisma } = fakePrisma({ global: [] });
    const cfg = new AppConfigService(prisma, fakeRedis().service);

    await expect(cfg.get(ORG, 'tax.igv_rate')).rejects.toBeInstanceOf(ConfigKeyMissingError);
  });

  it('lanza si el valor en la base no cumple el esquema', async () => {
    const { service: prisma } = fakePrisma({ global: [{ key: 'tax.igv_rate', value: 5 }] });
    const cfg = new AppConfigService(prisma, fakeRedis().service);

    await expect(cfg.get(ORG, 'tax.igv_rate')).rejects.toBeInstanceOf(ConfigKeyInvalidError);
  });

  it('cachea: la segunda lectura no vuelve a tocar Postgres', async () => {
    const { service: prisma, calls } = fakePrisma({
      global: [{ key: 'tax.igv_rate', value: 0.18 }],
      subscriptions: { [ORG]: PLAN },
      entitlements: { [PLAN]: [] },
    });
    const cfg = new AppConfigService(prisma, fakeRedis().service);

    await cfg.get(ORG, 'tax.igv_rate');
    const snapshot = { ...calls };
    await cfg.get(ORG, 'tax.igv_rate');

    expect(calls).toEqual(snapshot);
  });

  it('invalidateOrg fuerza a releer las capas de la organización', async () => {
    const { service: prisma, calls } = fakePrisma({
      global: [{ key: 'tax.igv_rate', value: 0.18 }],
      subscriptions: { [ORG]: PLAN },
      entitlements: { [PLAN]: [] },
      orgOverrides: { [ORG]: [] },
    });
    const cfg = new AppConfigService(prisma, fakeRedis().service);

    await cfg.get(ORG, 'tax.igv_rate');
    const before = calls.appSetting;
    await cfg.invalidateOrg(ORG);
    await cfg.get(ORG, 'tax.igv_rate');

    expect(calls.appSetting).toBeGreaterThan(before);
  });

  it('si Redis está caído, degrada a leer de Postgres', async () => {
    const { service: prisma } = fakePrisma({ global: [{ key: 'tax.igv_rate', value: 0.18 }] });
    const cfg = new AppConfigService(prisma, fakeRedis({ broken: true }).service);

    await expect(cfg.get(ORG, 'tax.igv_rate')).resolves.toBe(0.18);
  });

  it('effectiveConfig combina capas y solo devuelve claves conocidas', async () => {
    const { service: prisma } = fakePrisma({
      global: [
        { key: 'tax.igv_rate', value: 0.18 },
        { key: 'clave.desconocida', value: 'x' },
      ],
      subscriptions: { [ORG]: PLAN },
      entitlements: { [PLAN]: [{ key: 'pdf_export', value: false }] },
      orgOverrides: { [ORG]: [{ key: 'pdf_export', value: true }] },
    });
    const cfg = new AppConfigService(prisma, fakeRedis().service);

    const eff = await cfg.effectiveConfig(ORG);
    expect(eff['tax.igv_rate']).toBe(0.18);
    expect(eff['pdf_export']).toBe(true); // override de org
    expect('clave.desconocida' in eff).toBe(false);
  });
});
