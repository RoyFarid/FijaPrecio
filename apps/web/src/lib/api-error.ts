/** Error normalizado de la API core (forma de excepción de NestJS). */
export interface ApiFieldIssue {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly issues: ApiFieldIssue[];

  constructor(status: number, message: string, issues: ApiFieldIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.issues = issues;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

interface NestErrorBody {
  message?: string | string[];
  error?: string;
  issues?: ApiFieldIssue[];
}

/** Convierte una respuesta no-OK en `ApiError`, tolerando body vacío o no-JSON. */
export async function toApiError(res: Response): Promise<ApiError> {
  let body: NestErrorBody = {};
  try {
    body = (await res.json()) as NestErrorBody;
  } catch {
    /* respuesta sin cuerpo JSON */
  }
  const message = Array.isArray(body.message)
    ? body.message.join(' ')
    : (body.message ?? body.error ?? `HTTP ${res.status}`);
  return new ApiError(res.status, message, body.issues ?? []);
}
