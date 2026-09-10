/**
 * Nombres de colas + contratos de payload. Fuente única para `api` (productor)
 * y `worker` (consumidor). BullMQ 5 prohíbe ":" en el nombre (separador de
 * claves Redis) => se usa ".".
 */
export const QUEUES = {
  consensusRecalc: 'consensus.recalc',
  consensusSweep: 'consensus.sweep',
  ocrParse: 'ocr.parse',
  scrapeOnDemand: 'scrape.on-demand',
  alertsCheck: 'alerts.check',
  notificationsSend: 'notifications.send',
  pdfExport: 'export.pdf',
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export interface ConsensusRecalcJob {
  canonicalInputId: string;
  region: string;
  scope: 'INPUT' | 'FINAL_PRODUCT';
  currency: string;
}

export interface JobPayloads {
  [QUEUES.consensusRecalc]: ConsensusRecalcJob;
  [QUEUES.consensusSweep]: Record<string, never>;
  [QUEUES.ocrParse]: { receiptId: string };
  [QUEUES.scrapeOnDemand]: { scrapingJobId: string };
  [QUEUES.alertsCheck]: { alertId?: string };
  [QUEUES.notificationsSend]: { notificationId: string };
  [QUEUES.pdfExport]: { productId: string; organizationId: string; requestedBy: string };
}
