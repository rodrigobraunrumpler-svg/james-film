'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminPackageDto } from '@james-film/contracts';
import { useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { Respuesta } from '@/lib/api/http';
import { keys } from '@/lib/api/keys';
import { mover } from '@/lib/listas/mover';
import { iconos, paquetes, type DatosPaquete } from '../services/paquetes';

type Cache = Respuesta<AdminPackageDto[]>;

export function usePaquetes() {
  return useQuery({
    queryKey: keys.packages.list(),
    queryFn: ({ signal }) => paquetes.listar({ signal }),
    select: (r) => r.data,
    staleTime: 10 * 60_000,
  });
}

export function useIconos() {
  return useQuery({
    queryKey: ['iconos'],
    queryFn: ({ signal }) => iconos.listar({ signal }),
    select: (r) => r.data,
    // Cadenas que cambian una vez al año: no hay motivo para volver a pedirlas.
    staleTime: Infinity,
  });
}

export function useGuardarPaquete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: DatosPaquete }) =>
      id ? paquetes.actualizar(id, datos) : paquetes.crear(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.packages.all }),
  });
}

export function useDestacarPaquete() {
  const qc = useQueryClient();
  const clave = keys.packages.list();

  return useMutation({
    mutationFn: (id: string) => paquetes.destacar(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: clave });
      const previo = qc.getQueryData<Cache>(clave);
      if (previo) {
        qc.setQueryData<Cache>(clave, {
          ...previo,
          // Exclusivo también en la caché: ver dos destacados hasta que responda
          // el servidor sería peor que no ser optimista.
          data: previo.data.map((p) => ({ ...p, isHighlighted: p.id === id })),
        });
      }
      return { previo };
    },
    onError: (_e, _v, contexto) => {
      if (contexto?.previo) qc.setQueryData<Cache>(clave, contexto.previo);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.packages.all }),
  });
}

export function useBorrarPaquete() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => paquetes.borrar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.packages.all }),
  });
}

export function useOrdenPaquetes() {
  const qc = useQueryClient();
  const clave = keys.packages.list();
  const ultimoBueno = useRef<AdminPackageDto[] | null>(null);

  const mutacion = useMutation({
    mutationFn: () => {
      const actual = qc.getQueryData<Cache>(clave);
      return paquetes.reordenar((actual?.data ?? []).map((p) => p.id));
    },
    onSuccess: (respuesta) => {
      qc.setQueryData<Cache>(clave, respuesta);
      ultimoBueno.current = null;
    },
    onError: () => {
      if (ultimoBueno.current) {
        qc.setQueryData<Cache>(clave, (viejo) =>
          viejo ? { ...viejo, data: ultimoBueno.current! } : viejo,
        );
      }
      ultimoBueno.current = null;
    },
  });

  const enviar = useDebouncedCallback(() => mutacion.mutate(), 800);

  const reordenar = (desde: number, hasta: number): void => {
    const actual = qc.getQueryData<Cache>(clave);
    if (!actual) return;
    ultimoBueno.current ??= actual.data;
    qc.setQueryData<Cache>(clave, { ...actual, data: mover(actual.data, desde, hasta) });
    enviar();
  };

  return { reordenar, fallo: mutacion.isError };
}
