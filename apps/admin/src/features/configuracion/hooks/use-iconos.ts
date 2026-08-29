'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/http';

/**
 * La lista canónica la da la API, que es la que valida contra ella. Quince
 * cadenas que cambian una vez al año: `staleTime: Infinity`.
 */
export function useIconosDisponibles() {
  return useQuery({
    queryKey: ['iconos'],
    queryFn: ({ signal }) => api.get<string[]>('/admin/icons', { signal }),
    select: (r) => r.data,
    staleTime: Infinity,
  });
}
