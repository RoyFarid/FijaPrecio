import { Injectable, NotFoundException } from '@nestjs/common';
import type { ConsensusRecalcJob } from '@fijaprecio/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Confirma una boleta parseada: cada línea con match de catálogo y precio se
   * vuelve una `PriceObservation(source=OCR)` ("Precio Verificado"), actualiza el
   * `lastKnownPrice` del `OrgInput` y encola el recálculo de consenso.
   */
  async confirm(receiptId: string): Promise<{ created: number }> {
    const receipt = await this.prisma.client.receipt.findUnique({
      where: { id: receiptId },
      include: {
        organization: { select: { region: true } },
        lineItems: {
          where: {
            confirmed: false,
            matchedCanonicalInputId: { not: null },
            unitPrice: { not: null },
          },
          include: { matchedCanonicalInput: { select: { baseUnit: true } } },
        },
      },
    });
    if (!receipt) throw new NotFoundException('Boleta no encontrada');
    if (receipt.status === 'CONFIRMED') return { created: 0 };

    const currency = receipt.currency ?? 'PEN';
    const region = receipt.organization.region;
    const observedAt = receipt.issuedAt ?? new Date();
    const user = await this.prisma.client.user.findUnique({
      where: { id: receipt.uploadedById },
      select: { reputation: true },
    });

    const tuples = new Map<string, ConsensusRecalcJob>();
    let created = 0;

    for (const li of receipt.lineItems) {
      const canonicalInputId = li.matchedCanonicalInputId!;
      const price = li.unitPrice!.toNumber();
      const unit = li.unit ?? li.matchedCanonicalInput!.baseUnit;

      const observation = await this.prisma.client.priceObservation.create({
        data: {
          scope: 'INPUT',
          canonicalInputId,
          organizationId: receipt.organizationId,
          reporterUserId: receipt.uploadedById,
          reporterReputation: user?.reputation ?? 0,
          price,
          currency,
          unit,
          region,
          source: 'OCR',
          sourceRef: `ocr:${li.id}`,
          observedAt,
        },
        select: { id: true },
      });

      await this.prisma.client.receiptLineItem.update({
        where: { id: li.id },
        data: { confirmed: true, priceObservationId: observation.id },
      });
      await this.prisma.client.orgInput.updateMany({
        where: { organizationId: receipt.organizationId, canonicalInputId },
        data: { lastKnownPrice: price },
      });

      const job: ConsensusRecalcJob = {
        canonicalInputId,
        region,
        scope: 'INPUT',
        currency,
      };
      tuples.set(`${canonicalInputId}|${region}|${currency}`, job);
      created += 1;
    }

    await this.prisma.client.receipt.update({
      where: { id: receiptId },
      data: { status: 'CONFIRMED' },
    });
    for (const job of tuples.values()) {
      await this.queue.enqueueConsensusRecalc(job);
    }

    return { created };
  }
}
