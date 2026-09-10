import { describe, expect, it } from 'vitest';
import { moneyTokens, parseMoney } from './money.js';

describe('parseMoney', () => {
  it.each([
    ['S/ 1,234.50', 1234.5],
    ['S/. 45.00', 45],
    ['1.234,56', 1234.56],
    ['US$ 2.50', 2.5],
    ['12', 12],
    ['1,50', 1.5],
    ['1.500', 1500],
    ['9.80', 9.8],
    ['agotado', null],
  ])('%s → %s', (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });
});

describe('moneyTokens', () => {
  it('extrae los importes de una fila en orden', () => {
    expect(moneyTokens('HARINA BLANCA FLOR 1KG   2    4.50   9.00')).toEqual([1, 2, 4.5, 9]);
  });

  it('ignora texto sin números', () => {
    expect(moneyTokens('GRACIAS POR SU COMPRA')).toEqual([]);
  });
});
