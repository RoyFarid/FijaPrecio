import { describe, expect, it } from 'vitest';
import { parseReceipt, parsedReceiptSchema, type OcrInput } from './index.js';

const fromText = (raw: string): OcrInput => ({
  lines: raw
    .trim()
    .split('\n')
    .map((t) => ({ text: t.trim(), confidence: 0.9 }))
    .filter((l) => l.text.length > 0),
});

const BODEGA = `
BODEGA DON JOSE
R.U.C. 20512345678
BOLETA DE VENTA ELECTRONICA
B001-00001234
FECHA: 15/03/2026
DESCRIPCION        CANT  P.UNIT  IMPORTE
HARINA BLANCA FLOR 1KG   2    4.50   9.00
AZUCAR RUBIA           1    4.20   4.20
ACEITE PRIMOR 1L        3    9.80   29.40
OP. GRAVADA         S/ 36.10
IGV 18%             S/  6.50
TOTAL              S/ 42.60
GRACIAS POR SU COMPRA
`;

describe('parseReceipt — boleta de bodega', () => {
  const r = parseReceipt(fromText(BODEGA));

  it('cabecera', () => {
    expect(r.issuerRuc).toBe('20512345678');
    expect(r.documentNumber).toBe('B001-00001234');
    expect(r.issuedAt).toBe('2026-03-15');
    expect(r.currency).toBe('PEN');
    expect(r.totalAmount).toBe(42.6);
    expect(r.igvAmount).toBe(6.5);
  });

  it('detecta las 3 líneas de ítem, no los totales', () => {
    expect(r.lines).toHaveLength(3);
    expect(r.lines.map((l) => l.total)).toEqual([9, 4.2, 29.4]);
  });

  it('parsea cantidad / precio unitario / unidad', () => {
    const harina = r.lines[0]!;
    expect(harina.rawDescription).toContain('HARINA');
    expect(harina.quantity).toBe(2);
    expect(harina.unitPrice).toBe(4.5);
    expect(harina.unit).toBe('kg');

    const aceite = r.lines[2]!;
    expect(aceite.quantity).toBe(3);
    expect(aceite.unitPrice).toBe(9.8);
    expect(aceite.unit).toBe('l');
  });

  it('confianza alta cuando qty·pu ≈ total', () => {
    expect(r.lines.every((l) => l.confidence > 0.8)).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.75);
  });

  it('valida contra el schema zod', () => {
    expect(parsedReceiptSchema.safeParse(r).success).toBe(true);
  });
});

describe('parseReceipt — factura en dólares', () => {
  const r = parseReceipt(
    fromText(`
FERRETERIA INDUSTRIAL S.A.C.
RUC: 20601234567
FACTURA ELECTRONICA F001-00000045
Fecha de emision: 03/01/2026
Moneda: US$
DESCRIPCION            CANT   P.UNIT   IMPORTE
TORNILLO HEXAGONAL 1/4      5      2.50     12.50
VALOR VENTA        US$ 10.59
IGV               US$  1.91
TOTAL             US$ 12.50
`),
  );

  it('moneda, documento y fecha', () => {
    expect(r.currency).toBe('USD');
    expect(r.documentNumber).toBe('F001-00000045');
    expect(r.issuedAt).toBe('2026-01-03');
    expect(r.totalAmount).toBe(12.5);
  });

  it('línea con qty·pu = total', () => {
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ quantity: 5, unitPrice: 2.5, total: 12.5 });
  });
});

describe('parseReceipt — OCR sucio, sin cabecera de tabla', () => {
  const r = parseReceipt(
    fromText(`
minimarket la esquina
ruc 10456789012
25/12/2025
pan frances 0.5 kg  1.80
2 gaseosa 2.5L      3.50  7.00
total  8.80
`),
  );

  it('extrae lo que puede', () => {
    expect(r.issuerRuc).toBe('10456789012');
    expect(r.issuedAt).toBe('2025-12-25');
    expect(r.totalAmount).toBe(8.8);
    expect(r.lines.length).toBeGreaterThanOrEqual(2);
  });

  it('deriva precio unitario desde la cantidad de la descripción', () => {
    const pan = r.lines.find((l) => /pan/i.test(l.rawDescription))!;
    expect(pan.quantity).toBe(0.5);
    expect(pan.unit).toBe('kg');
    expect(pan.unitPrice).toBe(3.6); // 1.80 / 0.5
  });
});

describe('parseReceipt — entrada vacía', () => {
  it('no explota', () => {
    const r = parseReceipt({ rawText: '' });
    expect(r.lines).toEqual([]);
    expect(r.confidence).toBe(0);
    expect(r.issuerRuc).toBeNull();
  });

  it('acepta rawText en vez de lines', () => {
    const r = parseReceipt({ rawText: 'RUC 20512345678\nTOTAL S/ 10.00' });
    expect(r.issuerRuc).toBe('20512345678');
    expect(r.totalAmount).toBe(10);
  });
});
