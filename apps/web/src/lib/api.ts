import { PUBLIC_API_URL } from './public-env';
import { ApiError, toApiError } from './api-error';

/**
 * Cliente HTTP de la API core para el navegador.
 *  - `credentials: 'include'` → viajan las cookies httpOnly `fp_at` / `fp_rt`.
 *  - En 401 intenta UN refresh (single-flight) y reintenta la petición una vez.
 *  - Nunca lee tokens: la sesión vive solo en cookies gestionadas por la API.
 */

const BASE = `${PUBLIC_API_URL.replace(/\/$/, '')}/v1`;

export interface ApiRequest {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Cuerpo JSON; se serializa automáticamente. */
  body?: unknown;
  signal?: AbortSignal;
  /** No intentar refresh en 401 (para los propios endpoints de auth). */
  skipRefresh?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function runRefresh(): Promise<boolean> {
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
  return res.ok;
}

function refreshOnce(): Promise<boolean> {
  refreshInFlight ??= runRefresh().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function apiFetch<T>(path: string, req: ApiRequest = {}): Promise<T> {
  const { method = 'GET', body, signal, skipRefresh = false } = req;

  const send = (): Promise<Response> =>
    fetch(BASE + path, {
      method,
      credentials: 'include',
      signal,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await send();

  if (res.status === 401 && !skipRefresh) {
    const ok = await refreshOnce();
    if (ok) res = await send();
  }

  if (!res.ok) throw await toApiError(res);
  return parse<T>(res);
}

export { ApiError };
