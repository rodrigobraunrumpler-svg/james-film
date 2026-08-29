'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { keys } from '@/lib/api/keys';
import { galerias } from '../services/galerias';

/**
 * Crear una galería lleva DIRECTO al editor: lo siguiente que va a hacer James
 * es subir los reels, y devolverlo a la lista sería un clic de más justo en el
 * momento en que decide si la herramienta le sirve.
 *
 * NO es optimista: el slug lo desambigua el servidor —«bodas», «bodas-2»— y
 * adivinarlo aquí sería inventarse una URL que puede no existir.
 */
export function useCrearGaleria() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (datos: { title: string; categoryId: string }) => galerias.crear(datos),
    onSuccess: (respuesta) => {
      void qc.invalidateQueries({ queryKey: keys.galleries.lists() });
      router.push(`/galerias/${respuesta.data.id}`);
    },
  });
}

export function useBorrarGaleria() {
  const qc = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => galerias.borrar(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.galleries.all });
      router.push('/');
    },
  });
}

export function useDestacarGaleria(id: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (isFeatured: boolean) => galerias.destacar(id, isFeatured),
    onSuccess: (respuesta) => {
      qc.setQueryData(keys.galleries.detail(id), respuesta);
      void qc.invalidateQueries({ queryKey: keys.galleries.lists() });
    },
  });
}
