'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { Alert } from '../lib/types';
import type { CreateAlertPayload, UpdateAlertPayload } from '../lib/api-payloads';

const key = ['alerts'] as const;

export function useAlerts() {
  return useQuery({
    queryKey: key,
    queryFn: ({ signal }) => apiFetch<Alert[]>('/alerts', { signal }),
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAlertPayload) =>
      apiFetch<Alert>('/alerts', { method: 'POST', body: payload }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useUpdateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateAlertPayload }) =>
      apiFetch<Alert>(`/alerts/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/alerts/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: key }),
  });
}
