import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { slugify } from '../auth/slug.js';
import type { CreateProductInput } from './dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orgId: string, userId: string, dto: CreateProductInput) {
    return this.prisma.client.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          organizationId: orgId,
          name: dto.name,
          slug: await this.uniqueSlug(tx, orgId, slugify(dto.name)),
          rubro: dto.rubro ?? null,
          currency: dto.currency,
          targetPrice: dto.targetPrice ?? null,
          targetMarginPct: dto.targetMarginPct ?? null,
          createdById: userId,
        },
      });

      // find-or-create de OrgInput por displayName (único por organización)
      const orgInputIds = new Map<string, string>();
      for (const line of dto.recipe.lines) {
        const name = line.input.name;
        if (orgInputIds.has(name)) continue;
        const existing = await tx.orgInput.findUnique({
          where: { organizationId_displayName: { organizationId: orgId, displayName: name } },
          select: { id: true },
        });
        if (existing) {
          if (line.input.unitCost != null) {
            await tx.orgInput.update({
              where: { id: existing.id },
              data: { lastKnownPrice: line.input.unitCost },
            });
          }
          orgInputIds.set(name, existing.id);
        } else {
          const created = await tx.orgInput.create({
            data: {
              organizationId: orgId,
              displayName: name,
              unit: line.input.unit,
              lastKnownPrice: line.input.unitCost ?? null,
              currency: dto.currency,
            },
            select: { id: true },
          });
          orgInputIds.set(name, created.id);
        }
      }

      await tx.productRecipe.create({
        data: {
          productId: product.id,
          version: 1,
          isActive: true,
          outputQuantity: dto.recipe.outputQuantity,
          outputUnit: dto.recipe.outputUnit ?? null,
          laborMinutes: dto.recipe.laborMinutes ?? null,
          createdById: userId,
          lines: {
            create: dto.recipe.lines.map((line, i) => ({
              orgInputId: orgInputIds.get(line.input.name)!,
              quantity: line.quantity,
              unit: line.unit ?? line.input.unit,
              wastePct: line.wastePct,
              unitCostOverride: line.unitCostOverride ?? null,
              sortOrder: i,
            })),
          },
          costComponents: {
            create: dto.recipe.components.map((c, i) => ({
              type: c.type,
              label: c.label,
              calc: c.calc,
              value: c.value,
              sortOrder: i,
            })),
          },
        },
      });

      return this.load(tx, orgId, product.id);
    });
  }

  async get(orgId: string, productId: string) {
    const product = await this.load(this.prisma.client, orgId, productId);
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
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
