'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminGalleryDto, AdminMediaDto } from '@james-film/contracts';
import { useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { keys } from '@/lib/api/keys';
import { mover } from '@/lib/listas/mover';
import type { Respuesta } from '@/lib/api/http';
import { orden } from '../services/galerias';

type Cache = Respuesta<AdminGalleryDto>;

/**
 * Reorden optimista con `PATCH` a los 800 ms. Arrastrar y esperar a la red en
 * cada movimiento sería inusable: James coloca ocho reels de un tirón.
 */
export function useOrdenMedios(galleryId: string) {
  const qc = useQueryClient();
  const clave = keys.galleries.detail(galleryId);
  /** Lo último que confirmó el servidor, para revertir si el PATCH falla. */
  const ultimoBueno = useRef<AdminMediaDto[] | null>(null);

  const mutacion = useMutation({
    // Los ids se construyen AL ENVIAR, no al arrastrar: entre el movimiento y
    // el PATCH puede confirmarse una subida, y omitirla la descolocaría.
    mutationFn: () => {
      const actual = qc.getQueryData<Cache>(clave);
      return orden.reordenarMedios(
        galleryId,
        (actual?.data.media ?? []).map((m) => m.id),
      );
    },
    onSuccess: (respuesta) => {
      // Devuelve la galería entera: `setQueryData` ahorra el refetch y elimina
      // la ventana en que caché y servidor discrepan.
      qc.setQueryData<Cache>(clave, respuesta);
      ultimoBueno.current = null;
    },
    onError: () => {
      const previo = ultimoBueno.current;
      if (previo) {
        qc.setQueryData<Cache>(clave, (viejo) =>
          viejo ? { ...viejo, data: { ...viejo.data, media: previo } } : viejo,
        );
      }
      ultimoBueno.current = null;
    },
  });

  const enviar = useDebouncedCallback(() => mutacion.mutate(), 800);

  const reordenar = (desde: number, hasta: number): void => {
    const actual = qc.getQueryData<Cache>(clave);
    if (!actual) return;

    // La foto para revertir se toma en el PRIMER movimiento de la ráfaga: con
    // una por movimiento, un fallo devolvería a un estado intermedio.
    ultimoBueno.current ??= actual.data.media;

    qc.setQueryData<Cache>(clave, {
      ...actual,
      data: { ...actual.data, media: mover(actual.data.media, desde, hasta) },
    });
    enviar();
  };

  return { reordenar, fallo: mutacion.isError };
}

export function useMarcarPortada(galleryId: string) {
  const qc = useQueryClient();
  const clave = keys.galleries.detail(galleryId);

  return useMutation({
    mutationFn: (mediaId: string) => orden.marcarPortada(galleryId, mediaId),
    onMutate: async (mediaId) => {
      await qc.cancelQueries({ queryKey: clave });
      const previo = qc.getQueryData<Cache>(clave);
      if (previo) {
        qc.setQueryData<Cache>(clave, {
          ...previo,
          data: {
            ...previo.data,
            // Exclusiva por galería, igual que en la API: marcar una desmarca
            // la anterior, o se verían dos portadas hasta que responda.
            media: previo.data.media.map((m) => ({ ...m, isFeatured: m.id === mediaId })),
          },
        });
      }
      return { previo };
    },
    onError: (_e, _v, contexto) => {
      if (contexto?.previo) qc.setQueryData<Cache>(clave, contexto.previo);
    },
    onSuccess: (respuesta) => qc.setQueryData<Cache>(clave, respuesta),
    // `coverUrl` de la LISTA se deriva de la portada: sin esto, la fila de la
    // galería seguiría enseñando la miniatura vieja.
    onSettled: () => qc.invalidateQueries({ queryKey: keys.galleries.lists() }),
  });
}
