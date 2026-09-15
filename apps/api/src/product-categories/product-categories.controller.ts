import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ProductCategoriesService } from './product-categories.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import {
  createProductCategoryAttributeSchema,
  createProductCategorySchema,
  listProductCategoriesQuerySchema,
  type CreateProductCategory,
  type CreateProductCategoryAttribute,
  type ListProductCategoriesQuery,
} from './dto.js';

/** Árbol rubro → categoría → subcategoría → tipo de producto, para navegar
 *  hacia el producto en vez de escribirlo (ver ProductCategory en schema.prisma). */
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private readonly categories: ProductCategoriesService) {}

  @Get('rubros')
  rubros(): Promise<string[]> {
    return this.categories.listRubros();
  }

  @Get()
  children(@Query(new ZodBody(listProductCategoriesQuerySchema)) query: ListProductCategoriesQuery) {
    return this.categories.listChildren(query.parentId, query.rubro);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.categories.getCategory(id);
  }

  @Post()
  create(
    @Body(new ZodBody(createProductCategorySchema)) dto: CreateProductCategory,
  ): Promise<{ id: string }> {
    return this.categories.createCategory(dto);
  }

  @Post(':id/attributes')
  createAttribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(createProductCategoryAttributeSchema)) dto: CreateProductCategoryAttribute,
  ): Promise<{ id: string }> {
    return this.categories.createAttribute(id, dto);
  }
}
