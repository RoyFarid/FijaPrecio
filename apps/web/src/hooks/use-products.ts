'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import type { ProductDetail, ProductListItem } from '../lib/types';
import type {
  CreateProductInput,
  RecipePayload,
  UpdateProductPayload,
} from '../lib/api-payloads';

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: ({ signal }) => apiFetch<ProductListItem[]>('/products', { signal }),
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: ({ signal }) => apiFetch<ProductDetail>(`/products/${id}`, { signal }),
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProductInput) =>
      apiFetch<{ id: string }>('/products', { method: 'POST', body: payload }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

function invalidateProduct(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  void queryClient.invalidateQueries({ queryKey: ['products'] });
  void queryClient.invalidateQueries({ queryKey: ['costing', id] });
  void queryClient.invalidateQueries({ queryKey: ['sensitivity', id] });
  void queryClient.invalidateQueries({ queryKey: ['radar', id] });
}

export function useUpdateProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateProductPayload) =>
      apiFetch<ProductDetail>(`/products/${id}`, { method: 'PATCH', body: patch }),
    onSuccess: () => invalidateProduct(queryClient, id),
  });
}

export function useReplaceRecipe(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (recipe: RecipePayload) =>
      apiFetch<ProductDetail>(`/products/${id}/recipe`, { method: 'PUT', body: recipe }),
    onSuccess: () => invalidateProduct(queryClient, id),
  });
}
