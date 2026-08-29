'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminCategoryDto } from '@james-film/contracts';
import { useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import type { Respuesta } from '@/lib/api/http';
import { keys } from '@/lib/api/keys';
import { mover } from '@/lib/listas/mover';
import { categorias, type DatosCategoria } from '../services/categorias';

type Cache = Respuesta<AdminCategoryDto[]>;

/**
 * La lectura es la MISMA que usan el editor de galería y paquetes: una sola
 * clave de caché, así el CRUD de esta pantalla y los selectores de las otras
 * nunca discrepan. El hook vive en `lib` porque lo comparten tres features.
 */
export { useCategoriasComoOpciones as useCategorias } from '@/lib/catalogo/categorias';

export function useGuardarCategoria() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, datos }: { id?: string; datos: DatosCategoria }) =>
      id ? categorias.actualizar(id, datos) : categorias.crear(datos),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.categories.all });
      // El selector del editor de galerías lee esta misma lista.
      void qc.invalidateQueries({ queryKey: keys.galleries.all });
    },
  });
}

export function useBorrarCategoria() {
  const qc = useQueryClient();

  return useMutation({
    // NO optimista: el servidor puede negarse con 409 si aún la usan, y quitar
    // la fila para devolverla medio segundo después es peor que esperar.
    mutationFn: (id: string) => categorias.borrar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.categories.all }),
  });
}

/** Optimista con reversión, y el PATCH agrupado: reordenar es una ráfaga. */
export function useOrdenCategorias() {
  const qc = useQueryClient();
  const clave = keys.categories.list();
  const ultimoBueno = useRef<AdminCategoryDto[] | null>(null);

  const mutacion = useMutation({
    // Los ids se construyen AL ENVIAR: entre el movimiento y el PATCH puede
    // crearse una categoría, y omitirla la dejaría descolocada.
    mutationFn: () => {
      const actual = qc.getQueryData<Cache>(clave);
      return categorias.reordenar((actual?.data ?? []).map((c) => c.id));
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

    // La foto para revertir se toma en el PRIMER movimiento de la ráfaga: una
    // por movimiento devolvería a un estado intermedio.
    ultimoBueno.current ??= actual.data;
    qc.setQueryData<Cache>(clave, { ...actual, data: mover(actual.data, desde, hasta) });
    enviar();
  };

  return { reordenar, fallo: mutacion.isError };
}
