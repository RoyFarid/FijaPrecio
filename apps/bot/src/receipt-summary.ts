interface SummaryLine {
  lineNo: number;
  rawDescription: string;
  quantity: number | null;
  unit: string | null;
  unitPrice: number | null;
  total: number | null;
  confidence: number;
  matchedName: string | null;
}

interface SummaryReceipt {
  issuerRuc: string | null;
  documentNumber: string | null;
  issuedAt: Date | null;
  currency: string | null;
  totalAmount: number | null;
  lines: SummaryLine[];
}

const money = (v: number | null, cur: string): string =>
  v == null ? '—' : `${cur === 'USD' ? 'US$' : 'S/'} ${v.toFixed(2)}`;

/** Texto (Markdown) del resumen que el bot manda para confirmar. */
export function formatReceiptSummary(r: SummaryReceipt): string {
  const cur = r.currency ?? 'PEN';
  const head = [
    '📄 *Boleta detectada*',
    r.issuerRuc ? `RUC ${r.issuerRuc}` : null,
    r.documentNumber ?? null,
  ]
    .filter(Boolean)
    .join(' · ');

  const meta = [
    r.issuedAt ? `Fecha ${r.issuedAt.toISOString().slice(0, 10)}` : null,
    r.totalAmount != null ? `Total ${money(r.totalAmount, cur)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const items = r.lines.map((l) => {
    const qty =
      l.quantity != null ? `${l.quantity}${l.unit ? ' ' + l.unit : ''} × ` : '';
    const priceBit =
      l.unitPrice != null ? `${qty}${money(l.unitPrice, cur)}` : money(l.total, cur);
    const status = l.matchedName
      ? `✅ ${l.matchedName}`
      : l.confidence < 0.5
        ? '❓ revisar'
        : '⚠️ sin match en catálogo';
    return `${l.lineNo}. ${l.rawDescription} — ${priceBit}\n   ${status}`;
  });

  return [
    head,
    meta,
    '',
    ...(items.length > 0 ? items : ['_No pude leer líneas de producto._']),
    '',
    'Confirma para registrar estos precios como *verificados*.',
  ].join('\n');
}
