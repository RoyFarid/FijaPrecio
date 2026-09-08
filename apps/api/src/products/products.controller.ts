import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { ZodBody } from '../common/zod-validation.pipe.js';
import { createProductSchema, type CreateProductInput } from './dto.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { CurrentOrg } from '../tenancy/current-org.decorator.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

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
}
