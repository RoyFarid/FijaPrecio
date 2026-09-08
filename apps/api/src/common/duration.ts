const UNIT_MS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/**
 * Convierte "15m" / "30d" / "12h" / "45s" a milisegundos.
 * Formato usado por JWT_ACCESS_TTL / JWT_REFRESH_TTL.
 */
export function durationToMs(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(`Duración inválida: "${value}" (esperado p. ej. "15m", "30d")`);
  }
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS]!;
}
