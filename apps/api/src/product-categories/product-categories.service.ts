import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { slugify } from '../auth/slug.js';
import type { CreateProductCategory, CreateProductCategoryAttribute } from './dto.js';

export interface ProductCategoryNode {
  id: string;
  name: string;
  slug: string;
  rubro: string | null;
  parentId: string | null;
  hasChildren: boolean;
}

@Injectable()
export class ProductCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Rubros existentes (categorías raíz) — el primer selector de la cascada. */
  async listRubros(): Promise<string[]> {
    const roots = await this.prisma.client.productCategory.findMany({
      where: { parentId: null, rubro: { not: null } },
      select: { rubro: true },
      distinct: ['rubro'],
      orderBy: { rubro: 'asc' },
    });
    return roots.map((r) => r.rubro).filter((r): r is string => r != null);
  }

  /** Hijos directos de `parentId`, o las categorías raíz si se omite (con
   *  filtro opcional por rubro — solo tiene sentido a nivel raíz). */
  async listChildren(parentId?: string, rubro?: string): Promise<ProductCategoryNode[]> {
    const rows = await this.prisma.client.productCategory.findMany({
      where: { parentId: parentId ?? null, ...(parentId == null && rubro ? { rubro } : {}) },
      orderBy: { name: 'asc' },
      include: { _count: { select: { children: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      rubro: r.rubro,
      parentId: r.parentId,
      hasChildren: r._count.children > 0,
    }));
  }

  /** Detalle de una categoría: breadcrumb hacia la raíz + atributos definidos. */
  async getCategory(id: string) {
    const category = await this.prisma.client.productCategory.findUnique({
      where: { id },
      include: { attributeDefs: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    const breadcrumb: Array<{ id: string; name: string }> = [];
    let currentParentId = category.parentId;
    while (currentParentId) {
      const parent: { id: string; name: string; parentId: string | null } | null =
        await this.prisma.client.productCategory.findUnique({
          where: { id: currentParentId },
          select: { id: true, name: true, parentId: true },
        });
      if (!parent) break;
      breadcrumb.unshift({ id: parent.id, name: parent.name });
      currentParentId = parent.parentId;
    }

    return { ...category, breadcrumb };
  }

  async createCategory(dto: CreateProductCategory): Promise<{ id: string }> {
    let rubro = dto.rubro ?? null;
    if (dto.parentId) {
      const parent = await this.prisma.client.productCategory.findUnique({
        where: { id: dto.parentId },
        select: { rubro: true },
      });
      if (!parent) throw new NotFoundException('Categoría padre no encontrada');
      rubro = parent.rubro; // las hijas heredan el rubro del árbol, no eligen uno propio
    }

    const slug = await this.uniqueSlug(slugify(dto.name));
    const row = await this.prisma.client.productCategory.create({
      data: { name: dto.name, slug, parentId: dto.parentId ?? null, rubro },
      select: { id: true },
    });
    return row;
  }

  async createAttribute(
    categoryId: string,
    dto: CreateProductCategoryAttribute,
  ): Promise<{ id: string }> {
    const category = await this.prisma.client.productCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Categoría no encontrada');

    const row = await this.prisma.client.productCategoryAttribute.create({
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
    return row;
  }

  private async uniqueSlug(base: string): Promise<string> {
    for (let i = 0; i < 50; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      const taken = await this.prisma.client.productCategory.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    return `${base}-${Date.now()}`;
  }
}
