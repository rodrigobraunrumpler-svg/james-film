'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { keys } from '@/lib/api/keys';
import { galerias, type FiltrosGalerias } from '../services/galerias';

export function useGalerias(filtros: FiltrosGalerias) {
  return useQuery({
    // El MISMO objeto que gestiona nuqs: URL y caché no pueden desincronizarse.
    queryKey: keys.galleries.list(filtros),
    queryFn: ({ signal }) => galerias.listar(filtros, { signal }),
    // Sin esto, cambiar de página sustituye la lista por un skeleton y la
    // pantalla parpadea entera en cada pulsación. Con datos ya en pantalla, un
    // skeleton es un retroceso: tenías información y pasas a tener menos.
    placeholderData: keepPreviousData,
  });
}
