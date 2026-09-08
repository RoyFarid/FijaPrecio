/**
 * Motor de costeo bottom-up. Función PURA y determinista: sin I/O, sin acceso a
 * DB ni a config global. Todos los parámetros de negocio entran por `config`
 * (los provee AppConfigService en la capa de servicio).
 *
 * Cálculo (todo "por lote" salvo que se indique lo contrario):
 *
 *   costoLinea       = cantidad × (1 + merma) × precioUnitario
 *   costoInsumos     = Σ costoLinea
 *   componentesNoPct = FIXED (abs) + PER_UNIT (× outputQty) + PER_HOUR (× horas)
 *   costoDirecto     = costoInsumos + componentesNoPct
 *   + PCT_OF_DIRECT_COST  → value × costoDirecto
 *   subtotal         = costoDirecto + Σ pctSobreDirecto
 *   + PCT_OF_TOTAL_COST   → value × subtotal            (base fija: evita recursión)
 *   costoTotal       = subtotal + Σ pctSobreTotal
 *   costoUnitario    = costoTotal / outputQuantity
 *
 *   margen           = producto.targetMarginPct ?? config.defaultMarginPct
 *   precioSinIGV     = markupOnPrice ? unit / (1 - margen) : unit × (1 + margen)
 *   precioSugerido   = precioSinIGV × (1 + igvRate)      (org sin IGV => igvRate = 0)
 *
 * Usa `number` (float) y redondea las salidas monetarias a 4 decimales. Migrar a
 * Decimal es una mejora futura si aparece deriva acumulada.
 */

export type CostComponentCalc =
  | 'FIXED'
  | 'PER_UNIT'
  | 'PER_HOUR'
  | 'PCT_OF_DIRECT_COST'
  | 'PCT_OF_TOTAL_COST';

export type PriceSource = 'override' | 'org_input' | 'consensus' | 'supplier' | 'missing';

export interface EngineLine {
  ref: string;
  label: string;
  quantity: number;
  unit: string;
  wastePct: number;
  unitCost: number;
  priceSource: PriceSource;
}

export interface EngineComponent {
  ref: string;
  label: string;
  type: string;
  calc: CostComponentCalc;
  value: number;
}

export interface EngineInput {
  currency: string;
  outputQuantity: number;
  laborMinutes: number;
  lines: EngineLine[];
  components: EngineComponent[];
  targetPrice?: number | null;
  targetMarginPct?: number | null;
}

export interface EngineConfig {
  igvRate: number;
  defaultMarginPct: number;
  priceFromMarkupOnPrice: boolean;
}

export interface BreakdownLine {
  kind: 'input' | 'component';
  ref: string;
  label: string;
  amount: number; // contribución al costo UNITARIO
  pctOfTotal: number; // fracción 0..1 del costo total
  priceSource?: PriceSource;
}

export interface EngineResult {
  currency: string;
  outputQuantity: number;
  totalCost: number;
  unitCost: number;
  suggestedPrice: number | null;
  marginPct: number | null; // margen realizado sobre precio sin IGV
  targetPrice: number | null;
  targetCost: number | null;
  costGap: number | null;
  lines: BreakdownLine[];
  warnings: string[];
  hasMissingPrices: boolean;
  configUsed: {
    igvRate: number;
    marginPct: number;
    marginSource: 'product' | 'config';
    priceFromMarkupOnPrice: boolean;
  };
}

export class CostingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CostingError';
  }
}

const round = (n: number, dp = 4): number => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

export function computeCosting(input: EngineInput, config: EngineConfig): EngineResult {
  if (!(input.outputQuantity > 0)) {
    throw new CostingError('outputQuantity debe ser mayor que 0');
  }
  const warnings: string[] = [];
  const { outputQuantity } = input;

  // --- 1. costo de insumos (por lote) --------------------------------------
  const lineCosts = input.lines.map((l) => {
    if (l.priceSource === 'missing' || l.unitCost <= 0) {
      if (l.priceSource === 'missing') warnings.push(`Sin precio para "${l.label}"`);
    }
    const cost = l.quantity * (1 + l.wastePct) * Math.max(l.unitCost, 0);
    return { line: l, cost };
  });
  const directInputCost = lineCosts.reduce((s, x) => s + x.cost, 0);

  // --- 2. componentes ----------------------------------------------------
  const hours = input.laborMinutes / 60;
  const compAmounts = new Map<string, number>();

  const nonPctCost = input.components
    .filter((c) => c.calc === 'FIXED' || c.calc === 'PER_UNIT' || c.calc === 'PER_HOUR')
    .reduce((sum, c) => {
      const amt =
        c.calc === 'FIXED'
          ? c.value
          : c.calc === 'PER_UNIT'
            ? c.value * outputQuantity
            : c.value * hours;
      compAmounts.set(c.ref, amt);
      return sum + amt;
    }, 0);

  const directCost = directInputCost + nonPctCost;

  const pctOfDirectCost = input.components
    .filter((c) => c.calc === 'PCT_OF_DIRECT_COST')
    .reduce((sum, c) => {
      const amt = c.value * directCost;
      compAmounts.set(c.ref, amt);
      return sum + amt;
    }, 0);

  const subtotal = directCost + pctOfDirectCost;

  const pctOfTotalCost = input.components
    .filter((c) => c.calc === 'PCT_OF_TOTAL_COST')
    .reduce((sum, c) => {
      const amt = c.value * subtotal;
      compAmounts.set(c.ref, amt);
      return sum + amt;
    }, 0);

  const totalCost = subtotal + pctOfTotalCost;
  const unitCost = totalCost / outputQuantity;

  // --- 3. precio ------------------------------------------------------
  const marginSource: 'product' | 'config' =
    input.targetMarginPct != null ? 'product' : 'config';
  const marginPctUsed = input.targetMarginPct ?? config.defaultMarginPct;

  let priceExTax: number | null;
  if (config.priceFromMarkupOnPrice) {
    if (marginPctUsed >= 1) {
      warnings.push('El margen objetivo es ≥ 100%: no se puede calcular precio por markup sobre precio');
      priceExTax = null;
    } else {
      priceExTax = unitCost / (1 - marginPctUsed);
    }
  } else {
    priceExTax = unitCost * (1 + marginPctUsed);
  }

  const suggestedPrice = priceExTax == null ? null : priceExTax * (1 + config.igvRate);
  const realizedMargin =
    priceExTax != null && priceExTax > 0 ? (priceExTax - unitCost) / priceExTax : null;

  // --- 4. target costing --------------------------------------------
  let targetCost: number | null = null;
  let costGap: number | null = null;
  const targetPrice = input.targetPrice ?? null;
  if (targetPrice != null && targetPrice > 0) {
    targetCost = (targetPrice / (1 + config.igvRate)) * (1 - marginPctUsed);
    costGap = unitCost - targetCost;
  }

  // --- 5. breakdown -------------------------------------------------
  const safeTotal = totalCost > 0 ? totalCost : 1;
  const lines: BreakdownLine[] = [
    ...lineCosts.map(({ line, cost }) => ({
      kind: 'input' as const,
      ref: line.ref,
      label: line.label,
      amount: round(cost / outputQuantity),
      pctOfTotal: round(cost / safeTotal, 6),
      priceSource: line.priceSource,
    })),
    ...input.components.map((c) => {
      const amt = compAmounts.get(c.ref) ?? 0;
      return {
        kind: 'component' as const,
        ref: c.ref,
        label: c.label,
        amount: round(amt / outputQuantity),
        pctOfTotal: round(amt / safeTotal, 6),
      };
    }),
  ];

  const hasMissingPrices = input.lines.some((l) => l.priceSource === 'missing');

  return {
    currency: input.currency,
    outputQuantity,
    totalCost: round(totalCost),
    unitCost: round(unitCost),
    suggestedPrice: suggestedPrice == null ? null : round(suggestedPrice),
    marginPct: realizedMargin == null ? null : round(realizedMargin, 6),
    targetPrice: targetPrice == null ? null : round(targetPrice),
    targetCost: targetCost == null ? null : round(targetCost),
    costGap: costGap == null ? null : round(costGap),
    lines,
    warnings,
    hasMissingPrices,
    configUsed: {
      igvRate: config.igvRate,
      marginPct: marginPctUsed,
      marginSource,
      priceFromMarkupOnPrice: config.priceFromMarkupOnPrice,
    },
  };
}
