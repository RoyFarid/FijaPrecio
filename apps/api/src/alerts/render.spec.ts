import { describe, expect, it } from 'vitest';
import { renderTemplate } from '@fijaprecio/shared-types';

describe('renderTemplate', () => {
  it('sustituye {{clave}}', () => {
    expect(renderTemplate('Margen de {{productName}}: {{marginPct}}', { productName: 'Pan', marginPct: '18%' })).toBe(
      'Margen de Pan: 18%',
    );
  });

  it('tolera espacios y claves con punto', () => {
    expect(renderTemplate('{{ a.b }}', { 'a.b': 3 })).toBe('3');
  });

  it('claves ausentes → vacío', () => {
    expect(renderTemplate('x{{falta}}y', {})).toBe('xy');
  });

  it('deja el texto sin placeholders intacto', () => {
    expect(renderTemplate('sin nada', {})).toBe('sin nada');
  });
});
