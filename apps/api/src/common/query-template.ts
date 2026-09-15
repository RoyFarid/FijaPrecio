/**
 * Arma la query de scraping a partir de la plantilla de la categoría y los
 * atributos llenados ("{tipoHarina} pan {peso}{pesoUnidad}" + { tipoHarina:
 * "integral", peso: 500, pesoUnidad: "g" } → "integral pan 500g"). Si falta
 * algún atributo que la plantilla referencia, no se arma (null) — mejor caer
 * al nombre plano que mandar una query con huecos.
 */
export function renderQueryTemplate(
  template: string,
  attributes: Record<string, unknown>,
): string | null {
  let missing = false;
  const rendered = template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = attributes[key];
    if (value == null || value === '') {
      missing = true;
      return '';
    }
    return String(value);
  });
  if (missing) return null;
  const collapsed = rendered.replace(/\s+/g, ' ').trim();
  return collapsed.length > 0 ? collapsed : null;
}

/**
 * Resuelve qué query mandarle al scraper, en orden de preferencia:
 * override manual (`radarQuery`) > plantilla de categoría + atributos >
 * nombre plano. Mismo criterio para insumos (`CanonicalInput`) y productos
 * (`Product`).
 */
export function resolveScrapeQuery(args: {
  radarQuery: string | null;
  name: string;
  categoryTemplate: string | null;
  attributes: Record<string, unknown>;
}): string {
  if (args.radarQuery) return args.radarQuery;
  if (args.categoryTemplate) {
    const rendered = renderQueryTemplate(args.categoryTemplate, args.attributes);
    if (rendered) return rendered;
  }
  return args.name;
}
