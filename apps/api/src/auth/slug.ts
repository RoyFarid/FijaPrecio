/** "Panadería José & Cía" -> "panaderia-jose-cia" */
export function slugify(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'org'
  );
}
