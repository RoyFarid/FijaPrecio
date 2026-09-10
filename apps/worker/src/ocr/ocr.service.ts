import { Injectable, Logger } from '@nestjs/common';
import { parseReceipt, type ParsedReceipt } from '@fijaprecio/receipt-parser';
import type { Prisma } from '@fijaprecio/db';
import { PrismaService } from '../prisma.js';
import { storage } from '../storage.js';
import { env } from '../config/env.js';

interface OcrPayload {
  rawText: string;
  lines: Array<{ text: string; confidence: number; bbox: [number, number, number, number] }>;
  provider: string;
}

interface CatalogMatch {
  id: string;
  name: string;
  similarity: number;
}

@Injectable()
export class OcrService {
  private readonly log = new Logger(OcrService.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(receiptId: string): Promise<Record<string, unknown>> {
    const receipt = await this.prisma.client.receipt.findUnique({
      where: { id: receiptId },
      select: { id: true, organizationId: true, storageKey: true, status: true },
    });
    if (!receipt) return { skipped: 'boleta inexistente' };
    if (receipt.status === 'CONFIRMED') return { skipped: 'ya confirmada' };

    await this.prisma.client.receipt.update({
      where: { id: receiptId },
      data: { status: 'PROCESSING' },
    });

    try {
      const bytes = await storage.get(receipt.storageKey);
      const provider = await this.resolveProvider(receipt.organizationId);
      const ocr = await this.callOcr(bytes, provider);
      const parsed = parseReceipt({ rawText: ocr.rawText, lines: ocr.lines });
      const minSim = await this.matchThreshold();

      const items = await Promise.all(
        parsed.lines.map(async (line, i) => ({
          receiptId,
          lineNo: line.lineNo || i + 1,
          rawDescription: line.rawDescription,
          matchedCanonicalInputId: await this.matchCanonical(line.rawDescription, minSim),
          quantity: line.quantity,
          unit: line.unit,
          unitPrice: line.unitPrice,
          total: line.total,
          confidence: line.confidence,
        })),
      );

      await this.persist(receiptId, parsed, ocr.provider, items);
      await this.notifyBot(receiptId);

      const matched = items.filter((it) => it.matchedCanonicalInputId).length;
      this.log.log(`boleta ${receiptId}: ${items.length} líneas, ${matched} con match`);
      return { status: 'PARSED', lines: items.length, matched };
    } catch (err) {
      const message = (err as Error).message.slice(0, 480);
      await this.prisma.client.receipt.update({
        where: { id: receiptId },
        data: { status: 'FAILED', errorMessage: message, processedAt: new Date() },
      });
      await this.notifyBot(receiptId).catch(() => undefined);
      this.log.error(`boleta ${receiptId} falló: ${message}`);
      return { status: 'FAILED', error: message };
    }
  }

  // ---------------------------------------------------------------------------

  private async callOcr(bytes: Buffer, provider: string): Promise<OcrPayload> {
    const resp = await fetch(`${env.OCR_URL}/internal/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': env.INTERNAL_API_TOKEN,
      },
      body: JSON.stringify({ imageBase64: bytes.toString('base64'), provider }),
    });
    if (!resp.ok) throw new Error(`OCR ${resp.status}: ${await resp.text()}`);
    return (await resp.json()) as OcrPayload;
  }

  private async matchCanonical(query: string, minSim: number): Promise<string | null> {
    if (query.trim().length < 3) return null;
    const url = new URL(`${env.API_URL}/v1/internal/catalog/match`);
    url.searchParams.set('q', query);
    url.searchParams.set('limit', '1');
    const resp = await fetch(url, { headers: { 'X-Internal-Token': env.INTERNAL_API_TOKEN } });
    if (!resp.ok) return null;
    const [best] = (await resp.json()) as CatalogMatch[];
    return best && best.similarity >= minSim ? best.id : null;
  }

  private async persist(
    receiptId: string,
    parsed: ParsedReceipt,
    ocrProvider: string,
    items: Array<Omit<Prisma.ReceiptLineItemCreateManyInput, 'id'>>,
  ): Promise<void> {
    await this.prisma.client.$transaction([
      this.prisma.client.receipt.update({
        where: { id: receiptId },
        data: {
          status: 'PARSED',
          ocrProvider: providerEnum(ocrProvider),
          issuerRuc: parsed.issuerRuc,
          documentNumber: parsed.documentNumber,
          issuedAt: parsed.issuedAt ? new Date(parsed.issuedAt) : null,
          currency: parsed.currency,
          totalAmount: parsed.totalAmount,
          processedAt: new Date(),
        },
      }),
      this.prisma.client.receiptLineItem.deleteMany({ where: { receiptId } }),
      this.prisma.client.receiptLineItem.createMany({ data: items }),
    ]);
  }

  private async notifyBot(receiptId: string): Promise<void> {
    if (!env.BOT_INTERNAL_URL) return;
    await fetch(`${env.BOT_INTERNAL_URL}/internal/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': env.INTERNAL_API_TOKEN,
      },
      body: JSON.stringify({ receiptId }),
    });
  }

  private async resolveProvider(orgId: string): Promise<string> {
    const [setting, sub] = await Promise.all([
      this.prisma.client.appSetting.findFirst({
        where: { scope: 'GLOBAL', key: 'ocr.provider_by_plan' },
        select: { value: true },
      }),
      this.prisma.client.subscription.findUnique({
        where: { organizationId: orgId },
        select: { plan: { select: { code: true } } },
      }),
    ]);
    const map = (setting?.value ?? {}) as Record<string, string>;
    const planCode = sub?.plan.code ?? 'FREE';
    return (map[planCode] ?? 'tesseract').toLowerCase();
  }

  private async matchThreshold(): Promise<number> {
    const row = await this.prisma.client.appSetting.findFirst({
      where: { scope: 'GLOBAL', key: 'catalog.match_min_similarity' },
      select: { value: true },
    });
    const v = Number(row?.value);
    return Number.isFinite(v) ? v : 0.35;
  }
}

function providerEnum(name: string): 'PADDLE' | 'TESSERACT' | 'TEXTRACT' | 'VISION' | 'GEMINI' {
  const upper = name.toUpperCase();
  return (['PADDLE', 'TESSERACT', 'TEXTRACT', 'VISION', 'GEMINI'] as const).includes(
    upper as never,
  )
    ? (upper as 'PADDLE')
    : 'TESSERACT';
}
