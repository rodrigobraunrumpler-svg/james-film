'use client';

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { ESTADOS_GALERIA } from '../services/galerias';

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
      estado: parseAsStringLiteral(ESTADOS_GALERIA).withDefault('todas'),
      q: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      pageSize: parseAsInteger.withDefault(20),
    },
    { clearOnDefault: true },
  );

  return { filtros, setFiltros };
}
