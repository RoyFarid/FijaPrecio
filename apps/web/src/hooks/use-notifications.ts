'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { NotificationView } from '../lib/types';

const listKey = (unreadOnly: boolean) => ['notifications', { unreadOnly }] as const;
const countKey = ['notifications', 'unread-count'] as const;

export function useNotifications(options: { unreadOnly?: boolean; limit?: number } = {}) {
  const { unreadOnly = false, limit = 20 } = options;
  const params = new URLSearchParams({ limit: String(limit) });
  if (unreadOnly) params.set('unreadOnly', 'true');

  return useQuery({
    queryKey: listKey(unreadOnly),
    queryFn: ({ signal }) =>
      apiFetch<NotificationView[]>(`/notifications?${params.toString()}`, { signal }),
  });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: countKey,
    queryFn: ({ signal }) => apiFetch<{ count: number }>('/notifications/unread-count', { signal }),
    refetchInterval: 60_000,
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ updated: number }>('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
