import { cookies } from 'next/headers';
import { clientEnv, serverEnv } from '../env';
import { toApiError } from './api-error';

/**
 * Cliente HTTP de la API core para Server Components / route handlers.
 *  - Reenvía las cookies de sesión que el navegador mandó al server de Next.
 *  - Sin refresh: si da 401, el llamador redirige a /login (el refresh es cosa
 *    del navegador, donde sí se pueden re-escribir cookies).
 *  - Usa la URL interna (`API_INTERNAL_URL`, red privada de Railway) si existe.
 */

const BASE = `${(serverEnv.API_INTERNAL_URL ?? clientEnv.NEXT_PUBLIC_API_URL).replace(/\/$/, '')}/v1`;

export async function serverApiFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const jar = await cookies();
  const cookieHeader = jar
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const res = await fetch(BASE + path, {
    method: init.method ?? 'GET',
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
