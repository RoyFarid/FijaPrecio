import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api';

/**
 * Vuelca los `issues` de un `ApiError` (400 de la API) en los campos del form.
 * Devuelve `true` si al menos un issue mapeó a un campo conocido.
 */
export function applyApiIssues<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields: readonly Path<T>[],
): boolean {
  if (!(error instanceof ApiError) || error.issues.length === 0) return false;
  let mapped = false;
  for (const issue of error.issues) {
    const field = issue.path as Path<T>;
    if (knownFields.includes(field)) {
      setError(field, { type: 'server', message: issue.message });
      mapped = true;
    }
  }
  return mapped;
}

/** Guarda contra open-redirect: solo rutas internas absolutas. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/dashboard';
  return next;
}
