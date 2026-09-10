import { describe, expect, it, vi } from 'vitest';
import { ApiError } from './api-error';
import { applyApiIssues, safeNextPath } from './form-errors';

describe('safeNextPath', () => {
  it('acepta rutas internas absolutas', () => {
    expect(safeNextPath('/products/123')).toBe('/products/123');
  });
  it('rechaza null, externas y protocol-relative', () => {
    expect(safeNextPath(null)).toBe('/dashboard');
    expect(safeNextPath('https://evil.com')).toBe('/dashboard');
    expect(safeNextPath('//evil.com')).toBe('/dashboard');
    expect(safeNextPath('products')).toBe('/dashboard');
  });
});

describe('applyApiIssues', () => {
  it('mapea issues a campos conocidos y devuelve true', () => {
    const setError = vi.fn();
    const err = new ApiError(400, 'x', [
      { path: 'email', message: 'inválido' },
      { path: 'unknown', message: 'no mapea' },
    ]);
    const mapped = applyApiIssues(err, setError as never, ['email', 'password']);
    expect(mapped).toBe(true);
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'inválido' });
    expect(setError).toHaveBeenCalledTimes(1);
  });

  it('devuelve false si no es ApiError o no hay issues', () => {
    const setError = vi.fn();
    expect(applyApiIssues(new Error('x'), setError as never, ['email'])).toBe(false);
    expect(applyApiIssues(new ApiError(500, 'x'), setError as never, ['email'])).toBe(false);
  });
});
