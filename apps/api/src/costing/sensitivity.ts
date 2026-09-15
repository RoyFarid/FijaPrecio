/**
 * Análisis de sensibilidad / cuello de botella (ARQUITECTURA §9.3).
 *
 * Toma la misma entrada que el motor de costeo y devuelve los "drivers" de costo
 * ordenados por contribución, y — si hay una brecha contra el costo objetivo —
 * cuánto habría que recortar en cada uno para cerrarla.
 *
 * `unitCost` es lineal en el precio de cada insumo y en el `value` de cada
 * componente (incluso a través de los componentes porcentuales), así que cada
 * "cierre de brecha" se resuelve exacto con 2 evaluaciones del motor: el baseline
 * y la misma entrada con ese knob en 0 (para obtener la pendiente).
 */
import type { SampleLink } from '@fijaprecio/shared-types';
import {
  computeCosting,
  type EngineComponent,
  type EngineConfig,
  type EngineInput,
  type EngineLine,
  type PriceSource,
} from './engine.js';

export interface SensitivityDriver {
  ref: string;
  label: string;
  kind: 'input' | 'component';
  unitCost: number; // contribución al costo unitario
  contributionPct: number; // fracción 0..1 del costo unitario total
  currentUnitPrice: number | null; // insumos: precio unitario resuelto; componentes: null
  priceSource?: PriceSource;
  /** Para cerrar TODA la brecha recortando solo este driver: */
  gapCloseReductionPct: number | null; // fracción a recortar de su costo
  gapCloseUnitPrice: number | null; // nuevo precio unitario del insumo
  feasibleAlone: boolean; // reducción ≤ 100%
  /** Mediana de mercado del consenso (se llena cuando exista ese módulo). */
  marketMedianPrice: number | null;
  /** Ofertas reales detrás de la mediana — solo cuando conviene mirarlas (ver
   *  `marketHint`: el mercado ofrece algo más barato que el precio actual).
   *  null => sin "ver opciones" en la UI, aunque haya datos de consenso. */
  marketSampleLinks: SampleLink[] | null;
}

export interface SensitivityResult {
  currency: string;
  unitCost: number;
  targetCost: number | null;
  costGap: number | null; // > 0 => hay que recortar
  overallReductionPct: number | null; // brecha / costo unitario (recorte parejo)
  drivers: SensitivityDriver[]; // ordenados por contribución desc
  headline: string | null;
}

const round = (n: number, dp = 4): number => {
  const f = 10 ** dp;
  return Math.round((n + Number.EPSILON) * f) / f;
};

/** unitCost del motor con un knob (precio de línea o value de componente) fijado. */
function unitCostWith(
  input: EngineInput,
  config: EngineConfig,
  patch: { lineRef?: string; compRef?: string; value: number },
): number {
  const lines: EngineLine[] = input.lines.map((l) =>
    l.ref === patch.lineRef ? { ...l, unitCost: patch.value } : l,
  );
  const components: EngineComponent[] = input.components.map((c) =>
    c.ref === patch.compRef ? { ...c, value: patch.value } : c,
  );
  return computeCosting({ ...input, lines, components }, config).unitCost;
}

/** ¿Vale la pena mostrarle al usuario las ofertas detrás de la mediana? Solo
 *  cuando el mercado ofrece este insumo más barato que lo que paga hoy. */
function marketOffersCheaperOption(
  marketMedianPrice: number | null,
  currentUnitPrice: number | null,
): boolean {
  return marketMedianPrice != null && currentUnitPrice != null && marketMedianPrice < currentUnitPrice;
}

export function analyzeSensitivity(
  input: EngineInput,
  config: EngineConfig,
  marketMedians: Record<string, number | null> = {},
  marketSampleLinks: Record<string, SampleLink[]> = {},
): SensitivityResult {
  const baseline = computeCosting(input, config);
  const { unitCost, targetCost, costGap, currency } = baseline;

  const gap = costGap != null && costGap > 0 ? costGap : null;
  const overallReductionPct = gap != null && unitCost > 0 ? round(gap / unitCost, 6) : null;

  const drivers: SensitivityDriver[] = baseline.lines.map((bl) => {
    const isInput = bl.kind === 'input';
    const srcLine = isInput ? input.lines.find((l) => l.ref === bl.ref) : undefined;
    const srcComp = !isInput ? input.components.find((c) => c.ref === bl.ref) : undefined;
    const knobValue = isInput ? (srcLine?.unitCost ?? 0) : (srcComp?.value ?? 0);

    let gapCloseReductionPct: number | null = null;
    let gapCloseUnitPrice: number | null = null;

    if (gap != null && targetCost != null && knobValue > 0) {
      // f(v) = a + b·v  (lineal). b = (unitCost - f(0)) / knobValue
      const f0 = unitCostWith(input, config, {
        lineRef: isInput ? bl.ref : undefined,
        compRef: isInput ? undefined : bl.ref,
        value: 0,
      });
      const slope = (unitCost - f0) / knobValue;
      if (slope > 0) {
        const solved = (targetCost - f0) / slope; // valor del knob que lleva unitCost a targetCost
        gapCloseUnitPrice = isInput && solved >= 0 ? round(solved) : null;
        gapCloseReductionPct = round(1 - solved / knobValue, 6);
      }
    }

    const feasibleAlone = gapCloseReductionPct == null || gapCloseReductionPct <= 1;
    const currentUnitPrice = isInput ? round(knobValue) : null;
    const marketMedianPrice = isInput ? (marketMedians[bl.ref] ?? null) : null;

    return {
      ref: bl.ref,
      label: bl.label,
      kind: bl.kind,
      unitCost: bl.amount,
      contributionPct: bl.pctOfTotal,
      currentUnitPrice,
      priceSource: bl.priceSource,
      gapCloseReductionPct,
      gapCloseUnitPrice,
      feasibleAlone,
      marketMedianPrice,
      // Siempre visible cuando hay datos de scraping — igual que la tabla del
      // radar de producto final (dejó de ser condicional a "conviene mirarlo").
      marketSampleLinks:
        isInput && marketSampleLinks[bl.ref]?.length ? (marketSampleLinks[bl.ref] ?? null) : null,
    };
  });

  drivers.sort((a, b) => b.contributionPct - a.contributionPct);

  return {
    currency,
    unitCost,
    targetCost,
    costGap,
    overallReductionPct,
    drivers,
    headline: buildHeadline(drivers, gap, overallReductionPct),
  };
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** "El mercado reporta ese insumo cerca de X" cuando la mediana ayuda al recorte. */
function marketHint(d: SensitivityDriver): string {
  if (!marketOffersCheaperOption(d.marketMedianPrice, d.currentUnitPrice)) return '';
  return ` El mercado reporta ese insumo cerca de ${round(d.marketMedianPrice as number)}.`;
}

function buildHeadline(
  drivers: SensitivityDriver[],
  gap: number | null,
  overallReductionPct: number | null,
): string | null {
  const top = drivers[0];
  if (!top) return null;

  if (gap == null) {
    return `"${top.label}" es el ${pct(top.contributionPct)} de tu costo unitario.${marketHint(top)}`;
  }

  if (top.feasibleAlone && top.gapCloseUnitPrice != null && top.currentUnitPrice != null) {
    return (
      `"${top.label}" es el ${pct(top.contributionPct)} de tu costo. ` +
      `Bajándolo de ${top.currentUnitPrice} a ${top.gapCloseUnitPrice} ` +
      `(${pct(top.gapCloseReductionPct ?? 0)} menos) cierras la brecha con tu precio objetivo.` +
      marketHint(top)
    );
  }

  const feasible = drivers.find(
    (d) => d.feasibleAlone && d.gapCloseUnitPrice != null && d.currentUnitPrice != null,
  );
  if (feasible) {
    return (
      `"${feasible.label}": bájalo de ${feasible.currentUnitPrice} a ${feasible.gapCloseUnitPrice} ` +
      `(${pct(feasible.gapCloseReductionPct ?? 0)} menos) para cerrar la brecha.` +
      marketHint(feasible)
    );
  }

  return (
    `Ningún insumo por sí solo cierra la brecha. ` +
    `Necesitas recortar ~${pct(overallReductionPct ?? 0)} en todo el costo o subir el precio objetivo.`
  );
}
