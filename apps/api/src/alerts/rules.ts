/**
 * Reglas de disparo de alertas — funciones PURAS. El servicio les pasa los
 * números ya resueltos (margen actual, mediana de consenso, snapshots de
 * mercado) y decide qué notificar.
 */

export interface RuleResult {
  triggered: boolean;
  context: Record<string, number>;
}

const NOT_TRIGGERED: RuleResult = { triggered: false, context: {} };

/** El margen del producto cayó por debajo del piso configurado. */
export function evaluateMarginDrop(
  currentMarginPct: number | null,
  floorPct: number,
): RuleResult {
  if (currentMarginPct == null) return NOT_TRIGGERED;
  return {
    triggered: currentMarginPct < floorPct,
    context: { marginPct: currentMarginPct, marginFloorPct: floorPct },
  };
}

/** La mediana de mercado del insumo superó lo que el usuario paga en > risePct. */
export function evaluateInputPriceRise(
  consensusMedian: number | null,
  baselinePrice: number | null,
  risePct: number,
): RuleResult {
  if (consensusMedian == null || baselinePrice == null || baselinePrice <= 0) {
    return NOT_TRIGGERED;
  }
  const changePct = (consensusMedian - baselinePrice) / baselinePrice;
  return {
    triggered: changePct > risePct,
    context: { marketPrice: consensusMedian, yourPrice: baselinePrice, changePct },
  };
}

/** La mediana de la competencia bajó > dropPct entre los dos últimos snapshots. */
export function evaluateCompetitorDrop(
  latestMedian: number | null,
  previousMedian: number | null,
  dropPct: number,
): RuleResult {
  if (latestMedian == null || previousMedian == null || previousMedian <= 0) {
    return NOT_TRIGGERED;
  }
  const changePct = (latestMedian - previousMedian) / previousMedian;
  return {
    triggered: changePct < -dropPct,
    context: { currentMedian: latestMedian, previousMedian, changePct },
  };
}
