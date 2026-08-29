'use client';

import { useQuery } from '@tanstack/react-query';
import { keys } from '@/lib/api/keys';
import { galerias } from '../services/galerias';

/**
 * Los números de las pestañas. Petición aparte de la lista a propósito: si
 * viajaran en la respuesta filtrada, «Borradores 3» valdría 3 estando en
 * Borradores y 0 estando en Publicadas — el contador diría lo contrario de
 * lo que cuenta.
 */
export function useRecuentosGalerias() {
  return useQuery({
    queryKey: keys.galleries.counts(),
    queryFn: ({ signal }) => galerias.contar({ signal }),
  });
}
