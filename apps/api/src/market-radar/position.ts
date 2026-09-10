import type { MarketRadarVerdict } from '@fijaprecio/shared-types';

export interface MarketBands {
  minPrice: number;
  p25: number | null;
  avgPrice: number;
  medianPrice: number | null;
  p75: number | null;
  premiumPrice: number | null;
}

export interface RadarPosition {
  vsMedianPct: number | null;
  headroomToMedian: number | null;
  verdict: MarketRadarVerdict;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** Dónde cae `suggested` respecto a las bandas del mercado. */
export function computeRadarPosition(
  suggested: number,
  market: MarketBands,
): RadarPosition {
  const { minPrice, p25, medianPrice, p75, premiumPrice, avgPrice } = market;
  const median = medianPrice ?? avgPrice;

  let verdict: MarketRadarVerdict;
  if (suggested < minPrice) {
    verdict = 'below_market';
  } else if (p25 != null && suggested < p25) {
    verdict = 'value';
  } else if (premiumPrice != null && suggested > premiumPrice) {
    verdict = 'above_market';
  } else if (p75 != null && suggested > p75) {
    verdict = 'premium';
  } else {
    verdict = 'competitive';
  }

  return {
    vsMedianPct: median > 0 ? round4((suggested - median) / median) : null,
    headroomToMedian: round4(median - suggested),
    verdict,
  };
}
