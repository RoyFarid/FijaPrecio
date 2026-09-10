import { describe, expect, it } from 'vitest';
import { formatMoney, formatNumber, formatPercent } from './format';

describe('format', () => {
  it('formatMoney: null / NaN → guion', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
  });

  it('formatMoney: incluye el monto y un símbolo de moneda', () => {
    const out = formatMoney(1234.5, 'PEN');
    expect(out).toContain('234');
    expect(out).toMatch(/S\/|PEN/);
    expect(out).not.toBe('—');
  });

  it('formatPercent: fracción 0..1', () => {
    expect(formatPercent(0.25)).toContain('25');
    expect(formatPercent(0.25)).toContain('%');
    expect(formatPercent(null)).toBe('—');
  });

  it('formatNumber respeta dígitos', () => {
    expect(formatNumber(3.14159, 2)).toMatch(/3[.,]14/);
    expect(formatNumber(undefined)).toBe('—');
  });
});
