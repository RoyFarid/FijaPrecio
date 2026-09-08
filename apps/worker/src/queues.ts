/**
 * Nombres de colas + contratos de payload. Fuente única para `api` (productor)
 * y `worker` (consumidor). `api` importa estas constantes vía copia ligera o,
 * mejor, moviéndolas a @fijaprecio/shared-types cuando se estabilicen.
 */
// BullMQ 5 prohíbe ":" en el nombre de la cola (lo usa como separador de claves
// Redis). Se usa "." como separador.
export const QUEUES = {
  consensusRecalc: 'consensus.recalc',
  ocrParse: 'ocr.parse',
  scrapeOnDemand: 'scrape.on-demand',
  alertsCheck: 'alerts.check',
  notificationsSend: 'notifications.send',
  pdfExport: 'export.pdf',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface JobPayloads {
  [QUEUES.consensusRecalc]: { canonicalInputId: string; region: string; scope: 'INPUT' | 'FINAL_PRODUCT' };
  [QUEUES.ocrParse]: { receiptId: string };
  [QUEUES.scrapeOnDemand]: { scrapingJobId: string };
  [QUEUES.alertsCheck]: { alertId?: string };
  [QUEUES.notificationsSend]: { notificationId: string };
  [QUEUES.pdfExport]: { productId: string; organizationId: string; requestedBy: string };
}
