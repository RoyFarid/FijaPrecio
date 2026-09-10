'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { CatalogMatch } from '../lib/types';

/** Autocompletado de insumos canónicos. La API exige `q` de 2+ chars. */
export function useCatalogSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['catalog', 'search', q],
    queryFn: ({ signal }) =>
      apiFetch<CatalogMatch[]>(`/catalog/inputs?q=${encodeURIComponent(q)}&limit=8`, { signal }),
    enabled: q.length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
