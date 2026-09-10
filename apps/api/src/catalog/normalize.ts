/**
 * Normaliza un nombre de insumo para el matching por trigram:
 *   minúsculas → sin tildes → sin tokens de unidad ("50kg", "20/1", "kg") →
 *   sin puntuación → espacios colapsados.
 *
 * La lista de unidades sale de `AppSetting units.allowed` (no hardcodeada).
 * Función pura: recibe la lista.
 */

const NOISE_WORDS = new Set([
  // envase / presentación
  'saco', 'bolsa', 'caja', 'paquete', 'unidad', 'unidades', 'pack', 'x',
  // conectores es
  'de', 'del', 'la', 'el', 'los', 'las', 'con', 'para', 'por', 'y',
]);

export function normalizeInputName(raw: string, allowedUnits: string[]): string {
  const units = new Set(allowedUnits.map((u) => u.toLowerCase()));

  const base = raw
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s./-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = base.split(' ').filter((tok) => {
    if (tok === '') return false;
    // "50kg", "1.5l", "20/1", "500ml"
    if (/^[\d.,/x-]+[a-z]*$/.test(tok)) {
      const suffix = tok.replace(/^[\d.,/x-]+/, '');
      return suffix !== '' && !units.has(suffix);
    }
    if (units.has(tok)) return false;
    if (NOISE_WORDS.has(tok)) return false;
    return true;
  });

  return tokens.join(' ').replace(/\s+/g, ' ').trim();
}
