import { getRequestConfig } from 'next-intl/server';
import messages from '../../messages/es.json';

/**
 * Configuración de next-intl. Español (Perú) como único locale por ahora;
 * cuando se añada inglés/portugués esto pasa a routing por `[locale]`.
 * Todos los textos visibles viven en `messages/es.json` — regla "cero hardcodeo".
 */
export const locale = 'es';
export const timeZone = 'America/Lima';

export default getRequestConfig(async () => ({
  locale,
  timeZone,
  messages,
}));
