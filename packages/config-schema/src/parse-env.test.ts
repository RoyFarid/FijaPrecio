import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zBool, zCsv, zInt, zOptional } from './parse-env.js';

describe('coacciones de entorno', () => {
  it('zBool interpreta strings comunes', () => {
    expect(zBool.parse('true')).toBe(true);
    expect(zBool.parse('1')).toBe(true);
    expect(zBool.parse('no')).toBe(false);
  });

  it('zInt convierte string a entero', () => {
    expect(zInt.parse('42')).toBe(42);
  });

  it('zCsv parte y limpia', () => {
    expect(zCsv.parse('a, b ,,c')).toEqual(['a', 'b', 'c']);
  });

  it('z.object rechaza faltantes', () => {
    const s = z.object({ FOO: z.string() });
    expect(s.safeParse({}).success).toBe(false);
  });

  it('zOptional trata "" y ausente como undefined, pero valida si hay valor', () => {
    const s = zOptional(z.string().url());
    expect(s.parse('')).toBeUndefined();
    expect(s.parse('   ')).toBeUndefined();
    expect(s.parse(undefined)).toBeUndefined();
    expect(s.parse('https://x.dev')).toBe('https://x.dev');
    expect(s.safeParse('no-es-url').success).toBe(false);
  });
});
