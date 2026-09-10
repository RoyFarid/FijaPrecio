/** Cuerpos de request que el frontend envía a la API core. */

export interface CreateProductLine {
  input: { name: string; unit: string; unitCost?: number };
  quantity: number;
  wastePct: number;
  unitCostOverride?: number;
}

export interface CreateProductComponent {
  type: string;
  label: string;
  calc: string;
  value: number;
}

export interface RecipePayload {
  outputQuantity: number;
  outputUnit?: string;
  laborMinutes?: number;
  lines: CreateProductLine[];
  components: CreateProductComponent[];
}

export interface CreateProductInput {
  name: string;
  rubro?: string;
  currency: string;
  targetPrice?: number;
  targetMarginPct?: number;
  recipe: RecipePayload;
}

export interface UpdateProductPayload {
  name?: string;
  rubro?: string | null;
  currency?: string;
  targetPrice?: number | null;
  targetMarginPct?: number | null;
  status?: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
}

export interface CreateAlertPayload {
  name: string;
  type: string;
  productId?: string;
  canonicalInputId?: string;
  thresholds: { marginFloorPct?: number; risePct?: number; dropPct?: number };
  channels: string[];
}

export interface UpdateAlertPayload {
  name?: string;
  enabled?: boolean;
  thresholds?: { marginFloorPct?: number; risePct?: number; dropPct?: number };
  channels?: string[];
}
