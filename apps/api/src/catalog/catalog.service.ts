import { Injectable, NotFoundException } from '@nestjs/common';
import type { CatalogMatch } from '@fijaprecio/shared-types';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { normalizeInputName } from './normalize.js';
import type {
  CreateCanonicalInput,
  CreateInputCategoryAttribute,
  UpdateCanonicalInput,
} from './dto.js';

export type { CatalogMatch };

interface RawRow {
  id: string;
  name: string;
  baseUnit: string;
  status: string;
  sim: number;
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async normalize(text: string): Promise<string> {
    const units = await this.config.getGlobal('units.allowed');
    return normalizeInputName(text, units);
  }

  /** Autocompletado: insumos canónicos ACTIVE rankeados por similitud trigram. */
  async search(query: string, limit = 10): Promise<CatalogMatch[]> {
    const normalized = await this.normalize(query);
    if (normalized.length < 2) return [];
    const minSim = await this.config.getGlobal('catalog.match_min_similarity');
    return this.trigramSearch(normalized, minSim, Math.min(limit, 25));
  }

  /**
   * Devuelve el `canonicalInputId` para un nombre libre:
   *  - si hay un match >= `catalog.match_auto_assign_similarity` → lo asigna
   *  - si no → crea uno nuevo (status de `catalog.autocreate_canonical_status`)
   *    y guarda el nombre original como alias.
   */
  async resolveOrCreateCanonical(
    rawName: string,
    unit: string,
  ): Promise<{ canonicalInputId: string; created: boolean; matchSimilarity: number }> {
    const normalized = await this.normalize(rawName);
    const [autoAssign, autocreateStatus] = await Promise.all([
      this.config.getGlobal('catalog.match_auto_assign_similarity'),
      this.config.getGlobal('catalog.autocreate_canonical_status'),
    ]);

    if (normalized.length >= 2) {
      const [best] = await this.trigramSearch(normalized, autoAssign, 1);
      if (best) {
        await this.rememberAlias(best.id, rawName, normalized);
        return { canonicalInputId: best.id, created: false, matchSimilarity: best.similarity };
      }
    }

    const created = await this.prisma.client.canonicalInput.create({
      data: {
        name: rawName.trim(),
        normalizedName: normalized || rawName.trim().toLowerCase(),
        baseUnit: unit,
        status: autocreateStatus,
      },
      select: { id: true },
    });
    return { canonicalInputId: created.id, created: true, matchSimilarity: 0 };
  }

  async createCanonicalInput(dto: CreateCanonicalInput, userId: string): Promise<{ id: string }> {
    const autocreateStatus = await this.config.getGlobal('catalog.autocreate_canonical_status');
    const row = await this.prisma.client.canonicalInput.create({
      data: {
        name: dto.name,
        normalizedName: await this.normalize(dto.name),
        baseUnit: dto.baseUnit,
        categoryId: dto.categoryId ?? null,
        description: dto.description ?? null,
        status: dto.status ?? autocreateStatus,
        radarQuery: dto.radarQuery ?? null,
        createdById: userId,
        aliases: {
          create: await Promise.all(
            (dto.aliases ?? []).map(async (alias) => ({
              alias,
              normalizedAlias: await this.normalize(alias),
              source: 'USER' as const,
            })),
          ),
        },
      },
      select: { id: true },
    });
    return { id: row.id };
  }

  /** PATCH de un insumo canónico (catálogo global, no por tenant). */
  async updateCanonicalInput(id: string, dto: UpdateCanonicalInput) {
    const exists = await this.prisma.client.canonicalInput.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Insumo canónico no encontrado');

    await this.prisma.client.canonicalInput.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
          normalizedName: await this.normalize(dto.name),
        }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.radarQuery !== undefined && { radarQuery: dto.radarQuery }),
        ...(dto.attributes !== undefined && {
          attributes: dto.attributes as Prisma.InputJsonValue,
        }),
      },
    });
    return this.getCanonicalInput(id);
  }

  async createCategoryAttribute(
    categoryId: string,
    dto: CreateInputCategoryAttribute,
  ): Promise<{ id: string }> {
    const category = await this.prisma.client.inputCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    return this.prisma.client.inputCategoryAttribute.create({
      data: {
        categoryId,
        key: dto.key,
        label: dto.label,
        valueType: dto.valueType,
        unit: dto.unit ?? null,
        options: dto.options ?? undefined,
        required: dto.required,
        helpText: dto.helpText ?? null,
        sortOrder: dto.sortOrder,
      },
      select: { id: true },
    });
  }

  async getCanonicalInput(id: string) {
    const row = await this.prisma.client.canonicalInput.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        aliases: { select: { alias: true, source: true }, orderBy: { weight: 'desc' } },
      },
    });
    if (!row) throw new NotFoundException('Insumo canónico no encontrado');
    return row;
  }

  listCategories() {
    return this.prisma.client.inputCategory.findMany({
      orderBy: [{ rubro: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, parentId: true, rubro: true },
    });
  }

  // ---------------------------------------------------------------------------

  private async trigramSearch(
    normalized: string,
    minSim: number,
    limit: number,
  ): Promise<CatalogMatch[]> {
    return this.prisma.client.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('pg_trgm.similarity_threshold', ${String(minSim)}, true)`;

      const byName = await tx.$queryRaw<RawRow[]>`
        SELECT id, name, "baseUnit", status::text AS status,
               similarity("normalizedName", ${normalized}) AS sim
        FROM "CanonicalInput"
        WHERE status = 'ACTIVE' AND "normalizedName" % ${normalized}
        ORDER BY sim DESC
        LIMIT ${limit}`;

      const byAlias = await tx.$queryRaw<RawRow[]>`
        SELECT ci.id, ci.name, ci."baseUnit", ci.status::text AS status,
               MAX(similarity(a."normalizedAlias", ${normalized})) AS sim
        FROM "CanonicalInputAlias" a
        JOIN "CanonicalInput" ci ON ci.id = a."canonicalInputId"
        WHERE ci.status = 'ACTIVE' AND a."normalizedAlias" % ${normalized}
        GROUP BY ci.id, ci.name, ci."baseUnit", ci.status
        ORDER BY sim DESC
        LIMIT ${limit}`;

      const merged = new Map<string, CatalogMatch>();
      for (const r of byName) {
        merged.set(r.id, {
          id: r.id,
          name: r.name,
          baseUnit: r.baseUnit,
          status: r.status,
          similarity: round(Number(r.sim)),
          matchedVia: 'name',
        });
      }
      for (const r of byAlias) {
        const sim = round(Number(r.sim));
        const existing = merged.get(r.id);
        if (!existing || sim > existing.similarity) {
          merged.set(r.id, {
            id: r.id,
            name: r.name,
            baseUnit: r.baseUnit,
            status: r.status,
            similarity: sim,
            matchedVia: existing && existing.similarity >= sim ? 'name' : 'alias',
          });
        }
      }

      return [...merged.values()]
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    });
  }

  private async rememberAlias(
    canonicalInputId: string,
    rawName: string,
    normalized: string,
  ): Promise<void> {
    if (!normalized) return;
    await this.prisma.client.canonicalInputAlias.upsert({
      where: {
        canonicalInputId_normalizedAlias: { canonicalInputId, normalizedAlias: normalized },
      },
      create: {
        canonicalInputId,
        alias: rawName.trim(),
        normalizedAlias: normalized,
        source: 'USER',
      },
      update: {},
    });
  }
}

const round = (n: number): number => Math.round(n * 1e4) / 1e4;
