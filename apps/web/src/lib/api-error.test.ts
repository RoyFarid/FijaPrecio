import { describe, expect, it } from 'vitest';
import { ApiError, toApiError } from './api-error';

const res = (status: number, body?: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('toApiError', () => {
  it('mensaje string de NestJS', async () => {
    const err = await toApiError(res(404, { statusCode: 404, message: 'No encontrado', error: 'Not Found' }));
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.message).toBe('No encontrado');
  });

  it('mensaje array (class-validator style) se une', async () => {
    const err = await toApiError(res(400, { message: ['a', 'b'] }));
    expect(err.message).toBe('a b');
  });

  it('issues del ZodBody se preservan', async () => {
    const err = await toApiError(
      res(400, { message: 'Datos inválidos', issues: [{ path: 'email', message: 'inválido' }] }),
    );
    expect(err.issues).toEqual([{ path: 'email', message: 'inválido' }]);
  });

  it('body vacío / no-JSON → fallback a HTTP <status>', async () => {
    const err = await toApiError(res(502));
    expect(err.message).toBe('HTTP 502');
    expect(err.issues).toEqual([]);
  });

  it('isUnauthorized', async () => {
    expect((await toApiError(res(401, {}))).isUnauthorized).toBe(true);
    expect((await toApiError(res(403, {}))).isUnauthorized).toBe(false);
  });
});
