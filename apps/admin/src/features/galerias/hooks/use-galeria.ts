'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AdminGalleryDto } from '@james-film/contracts';
import { useEffect, useRef } from 'react';
import { keys } from '@/lib/api/keys';
import { categorias, galerias, type DatosGaleria } from '../services/galerias';

export function useGaleria(id: string) {
  return useQuery({
    queryKey: keys.galleries.detail(id),
    queryFn: ({ signal }) => galerias.porId(id, { signal }),
    select: (r) => r.data,
  });
}

/**
 * Step 0 del Task 4: al montar, cada medio en PENDING se re-confirma.
 *
 * Es la red de seguridad ante la suspensión de pestaña de iOS — el modo de fallo
 * número uno subiendo desde el iPhone. El `confirm` es idempotente y hace HEAD
 * contra el bucket: lo que llegó entero pasa a READY **sin volver a subir un
 * byte**, y lo que no, a FAILED con el motivo.
 *
 * El SERVIDOR es la lista de pendientes: no se persiste nada en el navegador,
 * porque tras una recarga el `File` ya no existe en memoria de todas formas.
 */
export function useReconciliarPendientes(galeria: AdminGalleryDto | undefined) {
  const qc = useQueryClient();
  const yaHecho = useRef(new Set<string>());

  const { mutateAsync } = useMutation({ mutationFn: galerias.confirmar });

  // Volver a la pestaña tras una suspensión de iOS es el otro momento en que
  // los PENDING pueden haber terminado sin que nadie lo sepa. Se limpia el
  // registro de intentos —solo entonces— para que el efecto vuelva a mirar:
  // sin ese candado, cada confirm invalidaría la query, la query dispararía el
  // efecto y el efecto volvería a confirmar, en bucle.
  useEffect(() => {
    const alVolver = () => {
      if (document.visibilityState === 'visible') yaHecho.current.clear();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);

  useEffect(() => {
    if (!galeria) return;

    const pendientes = galeria.media.filter(
      (m) => m.status === 'PENDING' && !yaHecho.current.has(m.id),
    );
    if (pendientes.length === 0) return;

    for (const m of pendientes) yaHecho.current.add(m.id);

    void Promise.allSettled(pendientes.map((m) => mutateAsync(m.id))).then(() => {
      void qc.invalidateQueries({ queryKey: keys.galleries.detail(galeria.id) });
    });
  }, [galeria, mutateAsync, qc]);
}

export function useActualizarGaleria(id: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (datos: DatosGaleria) => galerias.actualizar(id, datos),
    onSuccess: (respuesta) => {
      // El PATCH devuelve la galería completa: setQueryData en vez de invalidar
      // ahorra el refetch y elimina la ventana en que caché y servidor discrepan.
      qc.setQueryData(keys.galleries.detail(id), respuesta);
      void qc.invalidateQueries({ queryKey: keys.galleries.lists() });
    },
  });
}

export function useCategorias() {
  return useQuery({
    queryKey: keys.categories.list(),
    queryFn: ({ signal }) => categorias.listar({ signal }),
    select: (r) => r.data,
    // Cuatro filas que cambian una vez al año: refetcharlas al navegar es ruido.
    staleTime: 10 * 60_000,
  });
}
