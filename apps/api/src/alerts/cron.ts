import { CronExpressionParser } from 'cron-parser';

/** Próxima ocurrencia de un patrón cron después de `from`. null si es inválido. */
export function nextCronOccurrence(pattern: string, from: Date): Date | null {
  try {
    return CronExpressionParser.parse(pattern, { currentDate: from }).next().toDate();
  } catch {
    return null;
  }
}
