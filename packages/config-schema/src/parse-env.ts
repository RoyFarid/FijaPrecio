import { z } from 'zod';

/**
 * Valida `source` (por defecto process.env) contra `schema`.
 * Si algo falta o es inválido => imprime un reporte legible y ABORTA el proceso.
 * Este es el mecanismo "fail-fast" del proyecto: ningún servicio arranca con
 * configuración incompleta ni con defaults silenciosos.
 */
export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  // Este paquete es la ÚNICA puerta de entrada a process.env en todo el monorepo.
  source: Record<string, unknown> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');

    console.error(
      `\n[config-schema] Configuración de entorno inválida:\n${issues}\n\n` +
        `Revisa .env.example y las variables del servicio en Railway.\n`,
    );
    process.exit(1);
  }

  return result.data;
}

/** Coacción común: "true"/"1"/"yes" => true. */
export const zBool = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no'])])
  .transform((v) => v === true || v === 'true' || v === '1' || v === 'yes');

/** Entero desde string de entorno. */
export const zInt = z.coerce.number().int();

/** Lista separada por comas => string[] (trim, sin vacíos). */
export const zCsv = z
  .string()
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

/** Secreto mínimo (evita placeholders triviales en prod). */
export const zSecret = (min = 32) => z.string().min(min, `debe tener al menos ${min} caracteres`);

/**
 * Campo opcional tolerante a placeholders vacíos: una línea `FOO=` en un `.env`
 * entrega `""`, no `undefined`, y rompería un `.url()`/`.min()`. Aquí `""` (o
 * solo espacios) se trata como ausente.
 */
export const zOptional = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    inner.optional(),
  );
