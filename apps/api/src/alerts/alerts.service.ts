import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CreateAlertInput, UpdateAlertInput } from '@fijaprecio/shared-types';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma/prisma.service.js';
import { AppConfigService } from '../config/app-config.service.js';

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfigService,
  ) {}

  async list(orgId: string) {
    return this.prisma.client.alert.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(orgId: string, userId: string, dto: CreateAlertInput) {
    const max = await this.config.get(orgId, 'alerts_max');
    const count = await this.prisma.client.alert.count({ where: { organizationId: orgId } });
    if (max !== -1 && count >= max) {
      throw new ForbiddenException(`Tu plan permite ${max} alertas (tienes ${count})`);
    }

    await this.assertRefsBelongToOrg(orgId, dto.productId, dto.canonicalInputId);

    return this.prisma.client.alert.create({
      data: {
        organizationId: orgId,
        createdById: userId,
        name: dto.name,
        type: dto.type,
        productId: dto.productId ?? null,
        canonicalInputId: dto.canonicalInputId ?? null,
        thresholds: dto.thresholds as Prisma.InputJsonValue,
        channels: dto.channels,
      },
    });
  }

  async update(orgId: string, alertId: string, dto: UpdateAlertInput) {
    const data: Prisma.AlertUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.channels !== undefined) data.channels = dto.channels;
    if (dto.thresholds !== undefined) data.thresholds = dto.thresholds as Prisma.InputJsonValue;

    const { count } = await this.prisma.client.alert.updateMany({
      where: { id: alertId, organizationId: orgId },
      data,
    });
    if (count === 0) throw new NotFoundException('Alerta no encontrada');
    return this.prisma.client.alert.findUnique({ where: { id: alertId } });
  }

  async remove(orgId: string, alertId: string): Promise<void> {
    const { count } = await this.prisma.client.alert.deleteMany({
      where: { id: alertId, organizationId: orgId },
    });
    if (count === 0) throw new NotFoundException('Alerta no encontrada');
  }

  // ---------------------------------------------------------------------------

  private async assertRefsBelongToOrg(
    orgId: string,
    productId?: string,
    canonicalInputId?: string,
  ): Promise<void> {
    if (productId) {
      const p = await this.prisma.client.product.findFirst({
        where: { id: productId, organizationId: orgId },
        select: { id: true },
      });
      if (!p) throw new NotFoundException('Producto no encontrado');
    }
    if (canonicalInputId) {
      const c = await this.prisma.client.canonicalInput.findUnique({
        where: { id: canonicalInputId },
        select: { id: true },
      });
      if (!c) throw new NotFoundException('Insumo canónico no encontrado');
    }
  }
}
