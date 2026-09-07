'use client';

import { useQuery } from '@tanstack/react-query';
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
