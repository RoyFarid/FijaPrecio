'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { EffectiveConfig } from '../lib/types';

export function useEffectiveConfig() {
  return useQuery({
    queryKey: ['config', 'effective'],
    queryFn: ({ signal }) => apiFetch<EffectiveConfig>('/config', { signal }),
    staleTime: 5 * 60_000,
  });
}

/** Entitlements de plan que vale la pena mostrar al usuario, en orden. */
export const PLAN_ENTITLEMENT_KEYS = [
  'scenario_simulator',
  'on_demand_scrape',
  'pdf_export',
  'public_catalog',
  'api_access',
  'ocr_receipts_per_month',
  'scenario_max_overrides',
  'radar_history_days',
  'alerts_max',
] as const;
