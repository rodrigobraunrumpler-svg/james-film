'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminTestimonialDto } from '@james-film/contracts';
import { useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { Respuesta } from '@/lib/api/http';
import { keys } from '@/lib/api/keys';
import { mover } from '@/lib/listas/mover';
import { testimonios, type DatosTestimonio } from '../services/testimonios';

type Cache = Respuesta<AdminTestimonialDto[]>;

export function useTestimonios() {
  return useQuery({
    queryKey: keys.testimonials.list(),
    queryFn: ({ signal }) => testimonios.listar({ signal }),
    select: (r) => r.data,
    staleTime: 5 * 60_000,
  });
}

export function useGuardarTestimonio() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: DatosTestimonio }) =>
      id ? testimonios.actualizar(id, datos) : testimonios.crear(datos),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.testimonials.all }),
  });
}

export function useDestacarTestimonio() {
  const qc = useQueryClient();
  const clave = keys.testimonials.list();

  return useMutation({
    mutationFn: (id: string) => testimonios.destacar(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: clave });
      const previo = qc.getQueryData<Cache>(clave);
      if (previo) {
        qc.setQueryData<Cache>(clave, {
          ...previo,
          data: previo.data.map((t) => ({ ...t, isFeatured: t.id === id })),
        });
      }
      return { previo };
    },
    onError: (_e, _v, contexto) => {
      if (contexto?.previo) qc.setQueryData<Cache>(clave, contexto.previo);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.testimonials.all }),
  });
}

export function useBorrarTestimonio() {
  const qc = useQueryClient();

  return useMutation({
    // NO optimista: el borrado se lleva la captura del bucket y lleva
    // confirmación fuerte. Quitar la fila para devolverla sería peor.
    mutationFn: (id: string) => testimonios.borrar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.testimonials.all }),
  });
}

export function useOrdenTestimonios() {
  const qc = useQueryClient();
  const clave = keys.testimonials.list();
  const ultimoBueno = useRef<AdminTestimonialDto[] | null>(null);

  const mutacion = useMutation({
    mutationFn: () => {
      const actual = qc.getQueryData<Cache>(clave);
      return testimonios.reordenar((actual?.data ?? []).map((t) => t.id));
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
