import { describe, expect, it } from 'vitest';
import { normalizeInputName } from './normalize.js';

const UNITS = ['m', 'cm', 'kg', 'g', 'l', 'ml', 'unidad', 'cono', 'galon', 'pulgada'];
const n = (s: string): string => normalizeInputName(s, UNITS);

describe('normalizeInputName', () => {
  it('minúsculas y quita tildes', () => {
    expect(n('Algodón Pima')).toBe('algodon pima');
  });

  it('quita unidades sueltas y pegadas a números', () => {
    expect(n('Harina panadera 50kg')).toBe('harina panadera');
    expect(n('Aceite vegetal 1 L')).toBe('aceite vegetal');
    expect(n('Leche entera 400ml')).toBe('leche entera');
  });

  it('quita códigos numéricos tipo "20/1"', () => {
    expect(n('Hilo algodon 20/1')).toBe('hilo algodon');
  });

  it('quita puntuación y palabras de envase/conectores', () => {
    expect(n('Tela jersey (algodón)')).toBe('tela jersey algodon');
    expect(n('Saco de cemento')).toBe('cemento');
    expect(n('Botones para camisa')).toBe('botones camisa');
  });

  it('colapsa espacios y recorta', () => {
    expect(n('   Manteca    vegetal   ')).toBe('manteca vegetal');
  });

  it('descarta números sueltos y tokens que son puro ruido', () => {
    expect(n('kg')).toBe('');
    expect(n('Cierre #5')).toBe('cierre');
  });
});
