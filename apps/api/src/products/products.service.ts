import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { MarketRadarService } from '../market-radar/market-radar.service.js';
import { slugify } from '../auth/slug.js';
import type {
  CreateProductInput,
  ReplaceRecipeInput,
  UpdateProductInput,
} from './dto.js';

type RecipeDto = CreateProductInput['recipe'];

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly marketRadar: MarketRadarService,
  ) {}

  async create(orgId: string, userId: string, dto: CreateProductInput) {
    const canonicalByName = await this.resolveCanonicals(dto.recipe);

    const created = await this.prisma.withRls(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId: orgId,
          name: dto.name,
          slug: await this.uniqueSlug(tx, orgId, slugify(dto.name)),
          rubro: dto.rubro ?? null,
          radarQuery: dto.radarQuery ?? null,
          currency: dto.currency,
          targetPrice: dto.targetPrice ?? null,
          targetMarginPct: dto.targetMarginPct ?? null,
          createdById: userId,
        },
      });

      await this.writeRecipe(tx, {
        orgId,
        userId,
        productId: product.id,
        currency: dto.currency,
        version: 1,
        recipe: dto.recipe,
        canonicalByName,
      });

      const full = await this.load(tx, orgId, product.id);
      return this.serialize(full!);
    }, orgId);

    // fuera de la transacción, sin esperar: un producto nuevo no debe esperar
    // al barrido nocturno para tener su primer precio de mercado. Best-effort
    // y nunca lanza — ver MarketRadarService.triggerScan.
    void this.marketRadar.triggerScan(created.id);

    return created;
  }

  /** PATCH de los datos del producto (no la receta). */
  async update(orgId: string, productId: string, dto: UpdateProductInput) {
    return this.prisma.withRls(async (tx) => {
      const data: Prisma.ProductUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.rubro !== undefined) data.rubro = dto.rubro;
      if (dto.radarQuery !== undefined) data.radarQuery = dto.radarQuery;
      if (dto.currency !== undefined) data.currency = dto.currency;
      if (dto.targetPrice !== undefined) data.targetPrice = dto.targetPrice;
      if (dto.targetMarginPct !== undefined) data.targetMarginPct = dto.targetMarginPct;
      if (dto.status !== undefined) {
        data.status = dto.status;
        data.archivedAt = dto.status === 'ARCHIVED' ? new Date() : null;
      }

      const { count } = await tx.product.updateMany({
        where: { id: productId, organizationId: orgId },
        data,
      });
      if (count === 0) throw new NotFoundException('Producto no encontrado');

      const full = await this.load(tx, orgId, productId);
      return this.serialize(full!);
    }, orgId);
  }

  /** PUT de la receta activa: nueva versión, desactiva la anterior. */
  async replaceRecipe(
    orgId: string,
    userId: string,
    productId: string,
    dto: ReplaceRecipeInput,
  ) {
    const canonicalByName = await this.resolveCanonicals(dto);

    return this.prisma.withRls(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, organizationId: orgId },
        select: { currency: true, recipes: { orderBy: { version: 'desc' }, take: 1, select: { version: true } } },
      });
      if (!product) throw new NotFoundException('Producto no encontrado');

      await tx.productRecipe.updateMany({
        where: { productId, isActive: true },
        data: { isActive: false },
      });

      await this.writeRecipe(tx, {
        orgId,
        userId,
        productId,
        currency: product.currency,
        version: (product.recipes[0]?.version ?? 0) + 1,
        recipe: dto,
        canonicalByName,
      });

      const full = await this.load(tx, orgId, productId);
      return this.serialize(full!);
    }, orgId);
  }

  // ---------------------------------------------------------------------------

  /**
   * Resuelve el insumo canónico de cada línea ANTES de la tx: el matching hace
   * sus propias escrituras (crea CanonicalInput / alias) y una tx interna.
   */
  private async resolveCanonicals(recipe: RecipeDto): Promise<Map<string, string>> {
    const byName = new Map<string, string>();
    for (const line of recipe.lines) {
      if (byName.has(line.input.name)) continue;
      const { canonicalInputId } = await this.catalog.resolveOrCreateCanonical(
        line.input.name,
        line.input.unit,
      );
      byName.set(line.input.name, canonicalInputId);
    }
    return byName;
  }

  /** find-or-create de OrgInput por displayName + crea la ProductRecipe. */
  private async writeRecipe(
    tx: Prisma.TransactionClient,
    args: {
      orgId: string;
      userId: string;
      productId: string;
      currency: string;
      version: number;
      recipe: RecipeDto;
      canonicalByName: Map<string, string>;
    },
  ): Promise<void> {
    const { orgId, userId, productId, currency, version, recipe, canonicalByName } = args;

    const orgInputIds = new Map<string, string>();
    for (const line of recipe.lines) {
      const name = line.input.name;
      if (orgInputIds.has(name)) continue;
      const existing = await tx.orgInput.findUnique({
        where: { organizationId_displayName: { organizationId: orgId, displayName: name } },
        select: { id: true, canonicalInputId: true },
      });
      const canonicalInputId = canonicalByName.get(name) ?? null;
      if (existing) {
        const patch: Prisma.OrgInputUpdateInput = {};
        if (line.input.unitCost != null) patch.lastKnownPrice = line.input.unitCost;
        if (canonicalInputId && existing.canonicalInputId == null) {
          patch.canonicalInput = { connect: { id: canonicalInputId } };
        }
        if (Object.keys(patch).length > 0) {
          await tx.orgInput.update({ where: { id: existing.id }, data: patch });
        }
        orgInputIds.set(name, existing.id);
      } else {
        const created = await tx.orgInput.create({
          data: {
            organizationId: orgId,
            displayName: name,
            unit: line.input.unit,
            lastKnownPrice: line.input.unitCost ?? null,
            currency,
            canonicalInputId,
          },
          select: { id: true },
        });
        orgInputIds.set(name, created.id);
      }
    }

    await tx.productRecipe.create({
      data: {
        productId,
        version,
        isActive: true,
        outputQuantity: recipe.outputQuantity,
        outputUnit: recipe.outputUnit ?? null,
        laborMinutes: recipe.laborMinutes ?? null,
        createdById: userId,
        lines: {
          create: recipe.lines.map((line, i) => ({
            orgInputId: orgInputIds.get(line.input.name)!,
            quantity: line.quantity,
            unit: line.unit ?? line.input.unit,
            wastePct: line.wastePct,
            unitCostOverride: line.unitCostOverride ?? null,
            sortOrder: i,
          })),
        },
        costComponents: {
          create: recipe.components.map((c, i) => ({
            type: c.type,
            label: c.label,
            calc: c.calc,
            value: c.value,
            sortOrder: i,
          })),
        },
      },
    });
  }

  async get(orgId: string, productId: string) {
    const product = await this.load(this.prisma.client, orgId, productId);
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.serialize(product);
  }

  /** DTO limpio (Decimal→number, Date→ISO, receta activa) — lo devuelven get/create/update. */
  private serialize(product: NonNullable<Awaited<ReturnType<ProductsService['load']>>>) {
    const recipe = product.recipes[0] ?? null;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      rubro: product.rubro,
      radarQuery: product.radarQuery,
      description: product.description,
      currency: product.currency,
      status: product.status,
      targetPrice: product.targetPrice ? product.targetPrice.toNumber() : null,
      targetMarginPct: product.targetMarginPct ? product.targetMarginPct.toNumber() : null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      recipe: recipe
        ? {
            id: recipe.id,
            version: recipe.version,
            outputQuantity: recipe.outputQuantity.toNumber(),
            outputUnit: recipe.outputUnit,
            laborMinutes: recipe.laborMinutes ? recipe.laborMinutes.toNumber() : null,
            lines: recipe.lines.map((l) => ({
              id: l.id,
              orgInputId: l.orgInputId,
              displayName: l.orgInput.displayName,
              canonicalInputId: l.orgInput.canonicalInputId,
              quantity: l.quantity.toNumber(),
              unit: l.unit,
              wastePct: l.wastePct.toNumber(),
              unitCostOverride: l.unitCostOverride ? l.unitCostOverride.toNumber() : null,
              lastKnownPrice: l.orgInput.lastKnownPrice ? l.orgInput.lastKnownPrice.toNumber() : null,
            })),
            components: recipe.costComponents.map((c) => ({
              id: c.id,
              type: c.type,
              label: c.label,
              calc: c.calc,
              value: c.value.toNumber(),
            })),
          }
        : null,
    };
  }

  /** Lista para el dashboard. Sin costear cada fila (caro): solo metadatos. */
  async list(orgId: string) {
    const rows = await this.prisma.client.product.findMany({
      where: { organizationId: orgId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        rubro: true,
        currency: true,
        status: true,
        targetPrice: true,
        targetMarginPct: true,
        updatedAt: true,
        recipes: {
          where: { isActive: true },
          select: { _count: { select: { lines: true } } },
          take: 1,
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      rubro: r.rubro,
      currency: r.currency,
      status: r.status,
      targetPrice: r.targetPrice ? r.targetPrice.toNumber() : null,
      targetMarginPct: r.targetMarginPct ? r.targetMarginPct.toNumber() : null,
      updatedAt: r.updatedAt.toISOString(),
      lineCount: r.recipes[0]?._count.lines ?? 0,
    }));
  }

  // ---------------------------------------------------------------------------

  private load(client: Prisma.TransactionClient, orgId: string, productId: string) {
    return client.product.findFirst({
      where: { id: productId, organizationId: orgId },
      include: {
        recipes: {
          where: { isActive: true },
          include: {
            lines: { orderBy: { sortOrder: 'asc' }, include: { orgInput: true } },
            costComponents: { orderBy: { sortOrder: 'asc' } },
          },
        },
      },
    });
  }

  private async uniqueSlug(
    tx: Prisma.TransactionClient,
    orgId: string,
    base: string,
  ): Promise<string> {
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const taken = await tx.product.findFirst({
        where: { organizationId: orgId, slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `${base}-${Date.now()}`;
  }
}
