'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { keys } from '@/lib/api/keys';
import { panel } from '../services/panel';

/**
 * `staleTime` corto: el panel es lo primero que abre James y lo que más rápido
 * envejece —un aviso ya resuelto que sigue en pantalla se lee como que la
 * acción no funcionó—. Los 30s por defecto son demasiado para esta pantalla.
 */
export function usePanel() {
  return useQuery({
    queryKey: keys.dashboard.resumen(),
    queryFn: ({ signal }) => panel.resumen({ signal }),
    staleTime: 10_000,
  });
}

/**
 * «Publicar los N cambios». **Sin optimista**, y es una de las excepciones de
 * la regla: lo que decide el resultado no es esta petición sino Cloudflare al
 * otro lado, así que poner el contador a cero antes de tiempo enseñaría un
 * estado que la respuesta puede desmentir. Misma excepción que el slug con
 * desambiguación.
 *
 * El toast va al TERMINAR y dice lo que de verdad ocurrió: que se pidió la
 * reconstrucción. Prometer «ya está en la web» sería mentira — el build de
 * Astro tarda alrededor de un minuto.
 */
export function usePublicar() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: panel.publicar,
    onSuccess: () => {
      toast.success('Publicando', {
        description: 'La web se reconstruye. Tarda alrededor de un minuto.',
      });
      void qc.invalidateQueries({ queryKey: keys.dashboard.resumen() });
    },
    onError: () => {
      toast.error('No se pudo publicar', {
        description: 'La web sigue mostrando lo de antes. Vuelve a intentarlo.',
      });
    },
  });
}
