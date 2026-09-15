import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CatalogService, type CatalogMatch } from './catalog.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import {
  catalogSearchSchema,
  createCanonicalInputSchema,
  createInputCategoryAttributeSchema,
  updateCanonicalInputSchema,
  type CatalogSearchQuery,
  type CreateCanonicalInput,
  type CreateInputCategoryAttribute,
  type UpdateCanonicalInput,
} from './dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/public.decorator.js';
import { InternalTokenGuard } from '../auth/internal-token.guard.js';
import { RlsSystem } from '../tenancy/rls-mode.js';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Autocompletado de insumos canónicos (trigram). */
  @Get('inputs')
  search(
    @Query(new ZodBody(catalogSearchSchema)) query: CatalogSearchQuery,
  ): Promise<CatalogMatch[]> {
    return this.catalog.search(query.q, query.limit);
  }

  @Get('inputs/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.getCanonicalInput(id);
  }

  @Post('inputs')
  create(
    @CurrentUser('userId') userId: string,
    @Body(new ZodBody(createCanonicalInputSchema)) dto: CreateCanonicalInput,
  ): Promise<{ id: string }> {
    return this.catalog.createCanonicalInput(dto, userId);
  }

  @Patch('inputs/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(updateCanonicalInputSchema)) dto: UpdateCanonicalInput,
  ) {
    return this.catalog.updateCanonicalInput(id, dto);
  }

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Post('categories/:id/attributes')
  createCategoryAttribute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(createInputCategoryAttributeSchema)) dto: CreateInputCategoryAttribute,
  ): Promise<{ id: string }> {
    return this.catalog.createCategoryAttribute(id, dto);
  }
}

@Public()
@RlsSystem()
@UseGuards(InternalTokenGuard)
@Controller('internal/catalog')
export class InternalCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  /** Match trigram para el worker (OCR → ReceiptLineItem.matchedCanonicalInputId). */
  @Get('match')
  match(
    @Query(new ZodBody(catalogSearchSchema)) query: CatalogSearchQuery,
  ): Promise<CatalogMatch[]> {
    return this.catalog.search(query.q, query.limit);
  }
}
