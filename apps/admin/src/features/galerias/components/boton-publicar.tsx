'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AdminGalleryDto } from '@james-film/contracts';
import { toast } from 'sonner';
import type { Respuesta } from '@/lib/api/http';
import { keys } from '@/lib/api/keys';
import { galerias } from '../services/galerias';

/**
 * Publicar es lo único de esta pantalla que cambia lo que ve un cliente de
 * James, así que NO es optimista: el estado se mueve cuando el servidor lo
 * confirma. Lo pendiente se ve dentro del propio botón, nunca en un overlay.
 */
export function BotonPublicar({ galeria }: { galeria: AdminGalleryDto }) {
  const qc = useQueryClient();

  const mutacion = useMutation({
    mutationFn: () => galerias.publicar(galeria.id, !galeria.isPublished),
    onSuccess: (respuesta) => {
      qc.setQueryData<Respuesta<AdminGalleryDto>>(keys.galleries.detail(galeria.id), respuesta);
      void qc.invalidateQueries({ queryKey: keys.galleries.lists() });
      // Toast al TERMINAR, no al empezar.
      toast.success(respuesta.data.isPublished ? 'Galería publicada' : 'Galería despublicada');
    },
    onError: () => toast.error('No se pudo cambiar el estado. Inténtalo otra vez.'),
  });

  const publicada = galeria.isPublished;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className={`rounded px-2 py-1 text-xs font-medium ${
          publicada ? 'bg-green-100 text-green-800' : 'bg-neutral-200 text-neutral-700'
        }`}
      >
        {publicada ? 'Publicada' : 'Borrador'}
      </span>

      <button
        type="button"
        onClick={() => mutacion.mutate()}
        disabled={mutacion.isPending}
        className="min-h-11 rounded-md border px-4 text-sm font-medium disabled:opacity-60"
      >
        {mutacion.isPending ? 'Guardando…' : publicada ? 'Pasar a borrador' : 'Publicar galería'}
      </button>
    </div>
  );
}
