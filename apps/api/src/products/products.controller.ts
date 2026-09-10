import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import {
  createProductSchema,
  replaceRecipeSchema,
  updateProductSchema,
  type CreateProductInput,
  type ReplaceRecipeInput,
  type UpdateProductInput,
} from './dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@CurrentOrg() orgId: string) {
    return this.products.list(orgId);
  }

  @Post()
  create(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodBody(createProductSchema)) dto: CreateProductInput,
  ) {
    return this.products.create(orgId, userId, dto);
  }

  @Get(':id')
  get(@CurrentOrg() orgId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.products.get(orgId, id);
  }

  @Patch(':id')
  update(
    @CurrentOrg() orgId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(updateProductSchema)) dto: UpdateProductInput,
  ) {
    return this.products.update(orgId, id, dto);
  }

  @Put(':id/recipe')
  replaceRecipe(
    @CurrentOrg() orgId: string,
    @CurrentUser('userId') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodBody(replaceRecipeSchema)) dto: ReplaceRecipeInput,
  ) {
    return this.products.replaceRecipe(orgId, userId, id, dto);
  }
}
