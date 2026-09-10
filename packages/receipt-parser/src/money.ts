const MONEY_TOKEN = /(?:S\/\.?|US\$|USD|\$|PEN)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;

/** "S/ 1,234.50" / "1.234,56" / "45.00" → 1234.5 / 1234.56 / 45 */
export function parseMoney(text: string | null | undefined): number | null {
  if (!text) return null;
  const raw = text.trim();
  const m = /-?\d[\d.,]*/.exec(raw);
  if (!m) return null;
  let n = m[0];

  const hasDot = n.includes('.');
  const hasComma = n.includes(',');
  if (hasDot && hasComma) {
    const decSep = n.lastIndexOf(',') > n.lastIndexOf('.') ? ',' : '.';
    const thouSep = decSep === ',' ? '.' : ',';
    n = n.split(thouSep).join('').replace(decSep, '.');
  } else if (hasComma) {
    n = /^\d{1,3},\d{1,2}$/.test(n) ? n.replace(',', '.') : n.split(',').join('');
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(n)) {
    n = n.split('.').join(''); // "1.234" son miles
  }

  const value = Number(n);
  return Number.isFinite(value) ? value : null;
}

/** Todos los importes que aparecen en una línea, en orden. */
export function moneyTokens(line: string): number[] {
  const out: number[] = [];
  for (const match of line.matchAll(MONEY_TOKEN)) {
    const v = parseMoney(match[1]);
    if (v !== null) out.push(v);
  }
  return out;
}
