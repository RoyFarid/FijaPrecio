/** Nombre lindo para las fuentes de scraping — el slug es lo único que hay en la
 *  data (radar de producto y "ver opciones" de Sensibilidad). Sin entrada acá,
 *  se cae al slug tal cual (nunca queda sin etiqueta). */
const SOURCE_LABELS: Record<string, string> = {
  promart: 'Promart',
  'sodimac-pe': 'Sodimac',
  'plaza-vea': 'Plaza Vea',
  metro: 'Metro',
  wong: 'Wong',
  tottus: 'Tottus',
  'mercadolibre-pe': 'MercadoLibre',
};

export const sourceLabel = (slug: string): string => SOURCE_LABELS[slug] ?? slug;
