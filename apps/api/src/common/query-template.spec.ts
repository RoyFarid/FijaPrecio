import { describe, expect, it } from 'vitest';
import { renderQueryTemplate, resolveScrapeQuery } from './query-template.js';

describe('renderQueryTemplate', () => {
  it('sustituye los tokens con los atributos', () => {
    const r = renderQueryTemplate('{tipoHarina} pan {peso}{pesoUnidad}', {
      tipoHarina: 'integral',
      peso: 500,
      pesoUnidad: 'g',
    });
    expect(r).toBe('integral pan 500g');
  });

  it('colapsa espacios extra cuando un token queda vacío', () => {
    const r = renderQueryTemplate('pan {peso}', { peso: 500 });
    expect(r).toBe('pan 500');
  });

  it('devuelve null si falta un atributo que la plantilla referencia', () => {
    expect(renderQueryTemplate('{tipoHarina} pan', {})).toBeNull();
    expect(renderQueryTemplate('{tipoHarina} pan', { tipoHarina: '' })).toBeNull();
    expect(renderQueryTemplate('{tipoHarina} pan', { tipoHarina: null })).toBeNull();
  });

  it('sin tokens en la plantilla, la devuelve tal cual', () => {
    expect(renderQueryTemplate('pan de molde', {})).toBe('pan de molde');
  });
});

describe('resolveScrapeQuery', () => {
  it('prioriza el override manual sobre todo', () => {
    const q = resolveScrapeQuery({
      radarQuery: 'pan francés precocido',
      name: 'Pan',
      categoryTemplate: '{tipoHarina} pan',
      attributes: { tipoHarina: 'integral' },
    });
    expect(q).toBe('pan francés precocido');
  });

  it('sin override, usa la plantilla de categoría si se puede armar', () => {
    const q = resolveScrapeQuery({
      radarQuery: null,
      name: 'Pan',
      categoryTemplate: '{tipoHarina} pan',
      attributes: { tipoHarina: 'integral' },
    });
    expect(q).toBe('integral pan');
  });

  it('sin override y sin poder armar la plantilla, cae al nombre', () => {
    const q = resolveScrapeQuery({
      radarQuery: null,
      name: 'Pan',
      categoryTemplate: '{tipoHarina} pan',
      attributes: {},
    });
    expect(q).toBe('Pan');
  });

  it('sin override ni plantilla, usa el nombre', () => {
    const q = resolveScrapeQuery({
      radarQuery: null,
      name: 'Pan',
      categoryTemplate: null,
      attributes: {},
    });
    expect(q).toBe('Pan');
  });
});
