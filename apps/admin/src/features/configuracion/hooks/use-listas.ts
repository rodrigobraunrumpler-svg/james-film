'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminDifferentiatorDto, AdminSocialLinkDto } from '@james-film/contracts';
import { useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { Respuesta } from '@/lib/api/http';
import { mover } from '@/lib/listas/mover';
import {
  diferenciadores,
  redes,
  type DatosDiferenciador,
  type DatosRed,
} from '../services/configuracion';

const CLAVE_DIF = ['settings', 'differentiators'] as const;
const CLAVE_RED = ['settings', 'social-links'] as const;

export function useDiferenciadores() {
  return useQuery({
    queryKey: CLAVE_DIF,
    queryFn: ({ signal }) => diferenciadores.listar({ signal }),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
  });
}

export function useGuardarDiferenciador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: DatosDiferenciador }) =>
      id ? diferenciadores.actualizar(id, datos) : diferenciadores.crear(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_DIF }),
  });
}

export function useBorrarDiferenciador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => diferenciadores.borrar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_DIF }),
  });
}

export function useRedes() {
  return useQuery({
    queryKey: CLAVE_RED,
    queryFn: ({ signal }) => redes.listar({ signal }),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
  });
}

export function useGuardarRed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: DatosRed }) =>
      id ? redes.actualizar(id, datos) : redes.crear(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_RED }),
  });
}

export function useBorrarRed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => redes.borrar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CLAVE_RED }),
  });
}

/**
 * El mismo reorden optimista que las otras tres pantallas. Se repite a
 * propósito: la extracción del hook es el Task 6, cuando ya haya tres escritas
 * y se vea qué varía de verdad en vez de adivinarlo.
 */
function useOrden<T extends { id: string }>(
  clave: readonly unknown[],
  enviarIds: (ids: string[]) => Promise<Respuesta<T[]>>,
) {
  const qc = useQueryClient();
  const ultimoBueno = useRef<T[] | null>(null);

  const mutacion = useMutation({
    mutationFn: () => {
      const actual = qc.getQueryData<Respuesta<T[]>>(clave);
      return enviarIds((actual?.data ?? []).map((x) => x.id));
    },
    onSuccess: (respuesta) => {
      qc.setQueryData(clave, respuesta);
      ultimoBueno.current = null;
    },
    onError: () => {
      if (ultimoBueno.current) {
        qc.setQueryData<Respuesta<T[]>>(clave, (viejo) =>
          viejo ? { ...viejo, data: ultimoBueno.current! } : viejo,
        );
      }
      ultimoBueno.current = null;
    },
  });

  const enviar = useDebouncedCallback(() => mutacion.mutate(), 800);

  const reordenar = (desde: number, hasta: number): void => {
    const actual = qc.getQueryData<Respuesta<T[]>>(clave);
    if (!actual) return;
    ultimoBueno.current ??= actual.data;
    qc.setQueryData<Respuesta<T[]>>(clave, { ...actual, data: mover(actual.data, desde, hasta) });
    enviar();
  };

  return { reordenar, fallo: mutacion.isError };
}

export const useOrdenDiferenciadores = () =>
  useOrden<AdminDifferentiatorDto>(CLAVE_DIF, diferenciadores.reordenar);

export const useOrdenRedes = () => useOrden<AdminSocialLinkDto>(CLAVE_RED, redes.reordenar);
