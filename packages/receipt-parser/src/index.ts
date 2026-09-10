/**
 * @fijaprecio/receipt-parser — heurística para boletas/facturas peruanas.
 *
 * Entrada: resultado del servicio OCR ({ rawText, lines[] }).
 * Salida: RUC, nº de documento, fecha, moneda, total, IGV y las líneas de ítem
 * (descripción, cantidad, unidad, precio unitario, total) con un `confidence`
 * por línea y global — el bot usa eso para decidir qué mostrar como "verificado"
 * y qué pedir revisar.
 *
 * NO hace match contra el catálogo: eso es del worker (pg_trgm).
 */
import { z } from 'zod';
import { moneyTokens, parseMoney } from './money.js';

export interface OcrLineIn {
  text: string;
  confidence?: number;
  bbox?: [number, number, number, number];
}

export interface OcrInput {
  rawText?: string;
  lines?: OcrLineIn[];
  provider?: string;
}

export const parsedLineItemSchema = z.object({
  lineNo: z.number().int().positive(),
  rawDescription: z.string(),
  quantity: z.number().positive().nullable(),
  unit: z.string().nullable(),
  unitPrice: z.number().positive().nullable(),
  total: z.number().positive().nullable(),
  confidence: z.number().min(0).max(1),
});
export type ParsedLineItem = z.infer<typeof parsedLineItemSchema>;

export const parsedReceiptSchema = z.object({
  issuerRuc: z.string().nullable(),
  documentNumber: z.string().nullable(),
  issuedAt: z.string().nullable(),
  currency: z.enum(['PEN', 'USD']).nullable(),
  totalAmount: z.number().positive().nullable(),
  igvAmount: z.number().positive().nullable(),
  lines: z.array(parsedLineItemSchema),
  confidence: z.number().min(0).max(1),
});
export type ParsedReceipt = z.infer<typeof parsedReceiptSchema>;

// ---------------------------------------------------------------------------

const RUC_RE = /\b(1[0567]|20)\d{9}\b/;
const DOC_RE = /\b(E?B|E?F|BV|FA)\s?(\d{1,4})\s?-\s?(\d{1,8})\b/i;
const DATE_RE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;
const UNIT_RE =
  /(\d+(?:[.,]\d+)?)\s*(kg|kilos?|kilogramos?|g|gr|gramos?|l|lt|litros?|ml|cc|m|cm|mm|und?|unid(?:ad)?|par|docenas?|doc|pzas?|rollos?|conos?)\b/i;

const UNIT_CANON: Record<string, string> = {
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramo: 'kg', kilogramos: 'kg',
  g: 'g', gr: 'g', gramo: 'g', gramos: 'g',
  l: 'l', lt: 'l', litro: 'l', litros: 'l',
  ml: 'ml', cc: 'ml',
  m: 'm', cm: 'cm', mm: 'mm',
  un: 'unidad', und: 'unidad', unid: 'unidad', unidad: 'unidad',
  par: 'par', doc: 'docena', docena: 'docena', docenas: 'docena',
  pza: 'unidad', pzas: 'unidad', rollo: 'rollo', rollos: 'rollo', cono: 'cono', conos: 'cono',
};

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

function toLines(input: OcrInput): OcrLineIn[] {
  if (input.lines && input.lines.length > 0) return input.lines;
  return (input.rawText ?? '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text, confidence: 0.5 }));
}

function parseDate(day: string, month: string, year: string): string | null {
  let y = Number(year);
  const d = Number(day);
  const m = Number(month);
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2015 || y > 2100) return null;
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

function extractUnit(description: string): { unit: string | null; qty: number | null } {
  const m = UNIT_RE.exec(description);
  if (!m) return { unit: null, qty: null };
  const qty = parseMoney(m[1]);
  const unit = UNIT_CANON[m[2]!.toLowerCase()] ?? m[2]!.toLowerCase();
  return { unit, qty: qty && qty > 0 ? qty : null };
}

const LABEL_RE =
  /\b(sub\s?total|op\.?\s?(gravad|inafect|exoner|grat)|valor\s?venta|total|i\.?g\.?v|impuesto|descuento|redondeo|vuelto|efectivo|tarjeta|cambio|son:)\b/i;

function looksLikeItemRow(text: string): boolean {
  if (LABEL_RE.test(text)) return false;
  if (!/[a-záéíóúñ]{3,}/i.test(text)) return false;
  return moneyTokens(text).length >= 1;
}

function parseItemRow(text: string, ocrConf: number, lineNo: number): ParsedLineItem | null {
  const toks = text.trim().split(/\s+/);
  const trailing: number[] = [];
  while (toks.length > 1 && trailing.length < 4) {
    const last = toks[toks.length - 1]!;
    if (!/^(S\/\.?|US\$|\$)?[\d]([\d.,]*\d)?$/.test(last)) break;
    const value = parseMoney(toks.pop()!);
    if (value === null) break;
    trailing.unshift(value);
  }
  if (trailing.length === 0) return null;

  let rawDescription = toks.join(' ').replace(/[\s\-–|:.]+$/, '').trim();
  if (rawDescription.length < 2) return null;

  const lead = /^(\d+(?:[.,]\d+)?)\s+(?=\D)/.exec(rawDescription);
  let leadQty: number | null = null;
  if (lead) {
    leadQty = parseMoney(lead[1]);
    rawDescription = rawDescription.slice(lead[0].length).trim();
  }

  let quantity: number | null = null;
  let unitPrice: number | null = null;
  let total: number | null = null;
  if (trailing.length === 1) {
    total = trailing[0]!;
    quantity = leadQty;
  } else if (trailing.length === 2) {
    [unitPrice, total] = [trailing[0]!, trailing[1]!];
    quantity = leadQty;
  } else {
    const [q, pu, tt] = trailing.slice(-3) as [number, number, number];
    quantity = leadQty ?? q;
    unitPrice = pu;
    total = tt;
  }

  const { unit, qty: unitQty } = extractUnit(rawDescription);
  if (quantity === null && unitQty !== null) quantity = unitQty;
  if (quantity !== null && unitPrice === null && total !== null && quantity > 0) {
    unitPrice = round4(total / quantity);
  }

  let confidence = clamp(ocrConf, 0, 1) * 0.4;
  if (rawDescription.length >= 3) confidence += 0.2;
  if (total !== null) confidence += 0.15;
  if (quantity !== null && unitPrice !== null && total !== null) {
    const err = Math.abs(quantity * unitPrice - total) / Math.max(total, 1);
    confidence += err < 0.05 ? 0.25 : 0.05;
  }

  return {
    lineNo,
    rawDescription,
    quantity: quantity && quantity > 0 ? round4(quantity) : null,
    unit,
    unitPrice: unitPrice && unitPrice > 0 ? round4(unitPrice) : null,
    total: total && total > 0 ? round4(total) : null,
    confidence: clamp(round4(confidence), 0, 1),
  };
}

export function parseReceipt(input: OcrInput): ParsedReceipt {
  const lines = toLines(input);
  const texts = lines.map((l) => l.text);
  const fullText = texts.join('\n');

  const issuerRuc = RUC_RE.exec(fullText)?.[0] ?? null;

  const docMatch = DOC_RE.exec(fullText);
  const documentNumber = docMatch
    ? `${docMatch[1]!.toUpperCase().replace(/^E/, '')}${docMatch[2]!.padStart(3, '0')}-${docMatch[3]!.padStart(8, '0')}`
    : null;

  let issuedAt: string | null = null;
  const dateLine = texts.find((t) => /fecha|emisi[oó]n/i.test(t) && DATE_RE.test(t));
  const dm = DATE_RE.exec(dateLine ?? fullText);
  if (dm) issuedAt = parseDate(dm[1]!, dm[2]!, dm[3]!);

  let currency: 'PEN' | 'USD' | null = null;
  if (/US\$|USD|d[oó]lares/i.test(fullText)) currency = 'USD';
  else if (/S\/|soles|\bPEN\b/i.test(fullText)) currency = 'PEN';

  const totalAmount = pickAmount(texts, /\b(importe\s?total|total\s?a\s?pagar|total\s?venta|total)\b/i);
  const igvAmount = pickAmount(texts, /\bi\.?g\.?v\.?\b|impuesto\s?general/i);

  // --- líneas de ítem ---
  const headerIdx = texts.findIndex((t) =>
    /descrip|cant.*(p\.?\s?unit|precio|importe)|c[oó]digo.*descrip/i.test(t),
  );
  const searchFrom = headerIdx >= 0 ? headerIdx + 1 : 0;
  let footerIdx = texts.findIndex(
    (t, i) =>
      i > searchFrom &&
      /\b(sub\s?total|op\.?\s?(gravad|inafect|exoner)|valor\s?venta|son:)/i.test(t),
  );
  if (footerIdx < 0) footerIdx = texts.length;

  const items: ParsedLineItem[] = [];
  for (let i = searchFrom; i < footerIdx; i++) {
    const text = texts[i]!;
    if (!looksLikeItemRow(text)) continue;
    const parsed = parseItemRow(text, lines[i]?.confidence ?? 0.5, items.length + 1);
    if (parsed) items.push(parsed);
  }

  let confidence = 0;
  if (issuerRuc) confidence += 0.15;
  if (issuedAt) confidence += 0.1;
  if (totalAmount !== null) confidence += 0.2;
  if (items.length > 0) confidence += 0.2;
  if (items.length > 0) {
    confidence += (items.reduce((s, x) => s + x.confidence, 0) / items.length) * 0.35;
  }

  return {
    issuerRuc,
    documentNumber,
    issuedAt,
    currency,
    totalAmount,
    igvAmount,
    lines: items,
    confidence: clamp(round4(confidence), 0, 1),
  };
}

function pickAmount(texts: string[], label: RegExp): number | null {
  const candidates: number[] = [];
  for (const t of texts) {
    if (!label.test(t)) continue;
    // "IGV 18%" no debe aportar el 18 como importe
    const nums = moneyTokens(t.replace(/\d+(?:[.,]\d+)?\s*%/g, ' ')).filter((n) => n >= 0.1);
    if (nums.length > 0) candidates.push(Math.max(...nums));
  }
  return candidates.length > 0 ? round4(Math.max(...candidates)) : null;
}
