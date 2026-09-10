/** Formas de respuesta de la API core que consume el frontend. */

export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  role: MembershipRole;
}

export interface AuthResponse {
  user: SessionUser;
  accessToken: string;
}

export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'READ' | 'CANCELED';
export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'TELEGRAM';

export interface NotificationView {
  id: string;
  channel: NotificationChannel;
  templateCode: string;
  payload: Record<string, unknown>;
  title: string;
  body: string;
  status: NotificationStatus;
  readAt: string | null;
  createdAt: string;
}

/** `GET /v1/config` → config efectiva de la org (plan + overrides). */
export type EffectiveConfig = Record<string, unknown>;

// --- Productos + receta -----------------------------------------------------

export type ProductStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type CostComponentType =
  | 'LABOR'
  | 'OVERHEAD'
  | 'PACKAGING'
  | 'SHIPPING'
  | 'PLATFORM_FEE'
  | 'TAX'
  | 'OTHER';

export type CostCalcMethod =
  | 'FIXED'
  | 'PER_UNIT'
  | 'PER_HOUR'
  | 'PCT_OF_DIRECT_COST'
  | 'PCT_OF_TOTAL_COST';

export interface ProductListItem {
  id: string;
  name: string;
  slug: string | null;
  rubro: string | null;
  currency: string;
  status: ProductStatus;
  targetPrice: number | null;
  targetMarginPct: number | null;
  updatedAt: string;
  lineCount: number;
}

export interface RecipeLineView {
  id: string;
  orgInputId: string;
  displayName: string;
  canonicalInputId: string | null;
  quantity: number;
  unit: string;
  wastePct: number;
  unitCostOverride: number | null;
  lastKnownPrice: number | null;
}

export interface RecipeComponentView {
  id: string;
  type: CostComponentType;
  label: string;
  calc: CostCalcMethod;
  value: number;
}

export interface ProductDetail {
  id: string;
  name: string;
  slug: string | null;
  rubro: string | null;
  description: string | null;
  currency: string;
  status: ProductStatus;
  targetPrice: number | null;
  targetMarginPct: number | null;
  createdAt: string;
  updatedAt: string;
  recipe: {
    id: string;
    version: number;
    outputQuantity: number;
    outputUnit: string | null;
    laborMinutes: number | null;
    lines: RecipeLineView[];
    components: RecipeComponentView[];
  } | null;
}

// --- Costeo (contrato de @fijaprecio/shared-types, replicado) ---------------

export type CostPriceSource = 'override' | 'org_input' | 'consensus' | 'supplier' | 'missing';

export interface CostBreakdownLine {
  kind: 'input' | 'component';
  ref: string;
  label: string;
  amount: number;
  pctOfTotal: number;
  priceSource?: CostPriceSource;
}

export interface CostingResult {
  currency: string;
  outputQuantity: number;
  totalCost: number;
  unitCost: number;
  suggestedPrice: number | null;
  marginPct: number | null;
  targetPrice: number | null;
  targetCost: number | null;
  costGap: number | null;
  lines: CostBreakdownLine[];
  warnings: string[];
  hasMissingPrices: boolean;
  configUsed: Record<string, unknown>;
  computedAt: string;
}

export interface SensitivityDriver {
  ref: string;
  label: string;
  kind: 'input' | 'component';
  unitCost: number;
  contributionPct: number;
  currentUnitPrice: number | null;
  priceSource?: CostPriceSource;
  gapCloseReductionPct: number | null;
  gapCloseUnitPrice: number | null;
  feasibleAlone: boolean;
  marketMedianPrice: number | null;
}

export interface SensitivityResult {
  currency: string;
  unitCost: number;
  targetCost: number | null;
  costGap: number | null;
  overallReductionPct: number | null;
  drivers: SensitivityDriver[];
  headline: string | null;
  computedAt: string;
}

// --- Radar de mercado ------------------------------------------------------

export type MarketRadarVerdict =
  | 'below_market'
  | 'value'
  | 'competitive'
  | 'premium'
  | 'above_market';

export interface MarketHistoryPoint {
  capturedAt: string;
  minPrice: number;
  p25: number | null;
  avgPrice: number;
  medianPrice: number | null;
  p75: number | null;
  premiumPrice: number | null;
  sampleSize: number;
}

export interface MarketHistory {
  productId: string;
  region: string;
  currency: string;
  windowDays: number;
  points: MarketHistoryPoint[];
}

export interface MarketRadarView {
  productId: string;
  region: string;
  currency: string;
  market: {
    minPrice: number;
    p25: number | null;
    avgPrice: number;
    medianPrice: number | null;
    p75: number | null;
    premiumPrice: number | null;
    sampleSize: number;
    sourceBreakdown: Record<string, number>;
    capturedAt: string;
  } | null;
  yourPrice: { suggested: number | null; target: number | null };
  position: {
    vsMedianPct: number | null;
    headroomToMedian: number | null;
    verdict: MarketRadarVerdict;
  } | null;
}

// --- Alertas -------------------------------------------------------------

export type AlertType =
  | 'MARGIN_DROP'
  | 'INPUT_PRICE_RISE'
  | 'COMPETITOR_PRICE_DROP'
  | 'CONSENSUS_SHIFT';

export interface AlertThresholds {
  marginFloorPct?: number;
  risePct?: number;
  dropPct?: number;
}

export interface Alert {
  id: string;
  name: string;
  type: AlertType;
  enabled: boolean;
  productId: string | null;
  canonicalInputId: string | null;
  thresholds: AlertThresholds;
  channels: NotificationChannel[];
  lastTriggeredAt: string | null;
  createdAt: string;
}

// --- Simulador de escenarios --------------------------------------------

export type ScenarioOverrideType =
  | 'RECIPE_LINE'
  | 'INPUT_PRICE'
  | 'SUPPLIER_SWAP'
  | 'COST_COMPONENT'
  | 'MARGIN';

export interface ScenarioOverride {
  type: ScenarioOverrideType;
  targetRef: string | null;
  patch: Record<string, number | string>;
}

export interface ScenarioDelta {
  unitCost: number;
  suggestedPrice: number | null;
  marginPct: number | null;
  costGap: number | null;
}

export interface ScenarioOutcome {
  name: string;
  overrides: ScenarioOverride[];
  result: CostingResult;
  delta: ScenarioDelta;
}

export interface ScenarioComparison {
  currency: string;
  base: CostingResult;
  scenarios: ScenarioOutcome[];
  computedAt: string;
}

export interface SavedScenario {
  id: string;
  productId: string;
  name: string;
  notes: string | null;
  overrides: ScenarioOverride[];
  result: CostingResult | null;
  delta: ScenarioDelta | null;
  createdAt: string;
  updatedAt: string;
}

// --- Catálogo de insumos ------------------------------------------------

export interface CatalogMatch {
  id: string;
  name: string;
  baseUnit: string;
  status: string;
  similarity: number;
  matchedVia: 'name' | 'alias';
}
