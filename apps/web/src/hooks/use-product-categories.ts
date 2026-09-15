'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { ProductCategoryDetail, ProductCategoryNode } from '../lib/types';

export function useProductCategoryRubros() {
  return useQuery({
    queryKey: ['product-categories', 'rubros'],
    queryFn: ({ signal }) => apiFetch<string[]>('/product-categories/rubros', { signal }),
  });
}

/** Hijos de `parentId`, o raíces filtradas por `rubro` si se omite `parentId`. */
export function useProductCategoryChildren(parentId: string | null, rubro?: string | null) {
  const params = new URLSearchParams();
  if (parentId) params.set('parentId', parentId);
  else if (rubro) params.set('rubro', rubro);
  const qs = params.toString();

  return useQuery({
    queryKey: ['product-categories', 'children', parentId ?? null, rubro ?? null],
    queryFn: ({ signal }) =>
      apiFetch<ProductCategoryNode[]>(`/product-categories${qs ? `?${qs}` : ''}`, { signal }),
    enabled: parentId != null || rubro != null,
  });
}

export function useProductCategory(id: string | null) {
  return useQuery({
    queryKey: ['product-categories', id],
    queryFn: ({ signal }) => apiFetch<ProductCategoryDetail>(`/product-categories/${id}`, { signal }),
    enabled: id != null,
  });
}

export function useCreateProductCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; parentId?: string; rubro?: string }) =>
      apiFetch<{ id: string }>('/product-categories', { method: 'POST', body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['product-categories'] });
    },
  });
}
