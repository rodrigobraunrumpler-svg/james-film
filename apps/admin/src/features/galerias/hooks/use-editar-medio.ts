'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { keys } from '@/lib/api/keys';
import { medios } from '@/lib/media/servicios';

export function useEditarMedio(galleryId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      mediaId,
      datos,
    }: {
      mediaId: string;
      datos: { alt?: string | null; caption?: string | null };
    }) => medios.actualizar(mediaId, datos),
    // Invalida en vez de parchear la caché a mano: el PATCH devuelve el medio
    // suelto, no la galería, y reconstruirla aquí sería duplicar el mapper.
    onSettled: () => qc.invalidateQueries({ queryKey: keys.galleries.detail(galleryId) }),
  });
}
