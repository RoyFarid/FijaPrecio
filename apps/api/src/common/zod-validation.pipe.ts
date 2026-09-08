import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

/**
 * Valida el payload contra un esquema Zod. Sustituye a class-validator:
 * los DTOs del proyecto son esquemas Zod, no clases decoradas.
 *
 *   @Post()
 *   register(@Body(new ZodBody(registerSchema)) dto: RegisterInput) { ... }
 */
export class ZodBody<T extends z.ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Datos inválidos',
        issues: result.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
