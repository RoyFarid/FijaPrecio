'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, ApiError } from '../lib/api';
import type { ScenarioComparison, SavedScenario } from '../lib/types';
import type { ScenarioPayload } from '../lib/scenario-draft';

const listKey = (productId: string) => ['scenarios', productId] as const;

/** 403 = el plan no incluye `scenario_simulator`. */
export function isEntitlementError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function useScenarios(productId: string, enabled = true) {
  return useQuery({
    queryKey: listKey(productId),
    queryFn: ({ signal }) =>
      apiFetch<SavedScenario[]>(`/products/${productId}/scenarios`, { signal }),
    enabled,
    retry: (n, err) => !isEntitlementError(err) && n < 1,
  });
}

export function useCompareScenarios(productId: string) {
  return useMutation({
    mutationFn: (payload: { scenarios: ScenarioPayload[] }) =>
      apiFetch<ScenarioComparison>(`/products/${productId}/scenarios/compare`, {
        method: 'POST',
        body: payload,
      }),
  });
}

export function useCreateScenario(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ScenarioPayload & { notes?: string }) =>
      apiFetch<SavedScenario>(`/products/${productId}/scenarios`, {
        method: 'POST',
        body: payload,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: listKey(productId) }),
  });
}

export function useDeleteScenario(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/scenarios/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: listKey(productId) }),
  });
}

export function useRecomputeScenario(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<SavedScenario>(`/scenarios/${id}/recompute`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: listKey(productId) }),
  });
}
