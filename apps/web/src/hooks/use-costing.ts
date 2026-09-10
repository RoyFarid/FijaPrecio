'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../lib/api';
import type {
  CostingResult,
  MarketHistory,
  MarketRadarView,
  SensitivityResult,
} from '../lib/types';

/** `computeForProduct` lanza 404/400 si el producto no tiene receta activa. */
function noRecipeSafe(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}

export function useCosting(productId: string) {
  return useQuery({
    queryKey: ['costing', productId],
    queryFn: ({ signal }) =>
      apiFetch<CostingResult>(`/products/${productId}/costing`, { signal }),
    retry: (n, err) => !noRecipeSafe(err) && n < 1,
  });
}

export function useSensitivity(productId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['sensitivity', productId],
    queryFn: ({ signal }) =>
      apiFetch<SensitivityResult>(`/products/${productId}/costing/sensitivity`, { signal }),
    enabled,
    retry: (n, err) => !noRecipeSafe(err) && n < 1,
  });
}

export function useRadar(productId: string, region?: string) {
  const qs = region ? `?region=${encodeURIComponent(region)}` : '';
  return useQuery({
    queryKey: ['radar', productId, region ?? null],
    queryFn: ({ signal }) =>
      apiFetch<MarketRadarView>(`/products/${productId}/market-radar${qs}`, { signal }),
    retry: (n, err) => !noRecipeSafe(err) && n < 1,
  });
}

export function useRadarHistory(productId: string, region?: string) {
  const qs = region ? `?region=${encodeURIComponent(region)}` : '';
  return useQuery({
    queryKey: ['radar', productId, 'history', region ?? null],
    queryFn: ({ signal }) =>
      apiFetch<MarketHistory>(`/products/${productId}/market-radar/history${qs}`, { signal }),
    retry: (n, err) => !noRecipeSafe(err) && n < 1,
  });
}
