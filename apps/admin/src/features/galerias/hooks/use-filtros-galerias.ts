'use client';

import { parseAsInteger, useQueryStates } from 'nuqs';

/**
 * El estado de lista vive en la URL, y ese MISMO objeto es la clave de TanStack
 * Query. Una fuente, no dos: recargar mantiene la vista, el botón atrás funciona,
 * y no hay que sincronizar un `useState` con la caché.
 *
 * `clearOnDefault` deja la URL limpia mientras no se toque nada.
 */
export function useFiltrosGalerias() {
  const [filtros, setFiltros] = useQueryStates(
    {
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
    },
    { clearOnDefault: true },
  );

  return { filtros, setFiltros };
}
