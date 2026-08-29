'use client';

import { useQuery } from '@tanstack/react-query';
import type { AdminCategoryDto } from '@james-film/contracts';
import { api } from '@/lib/api/http';
import { keys } from '@/lib/api/keys';

/**
 * La lista de categorías COMO OPCIONES. Vive en `lib` y no en la feature de
 * categorías porque la necesitan tres: el editor de galería (un `<select>`),
 * paquetes (checkboxes) y la propia pantalla de categorías. **Ninguna feature
 * importa de otra**, así que lo compartido sube aquí — es literalmente la regla
 * de `CLAUDE.md`.
 *
 * El CRUD sigue viviendo en `features/categorias`: esto es solo la lectura.
 */
export function useCategoriasComoOpciones() {
  return useQuery({
    queryKey: keys.categories.list(),
    queryFn: ({ signal }) => api.get<AdminCategoryDto[]>('/admin/categories', { signal }),
    select: (r) => r.data,
    // Cuatro filas que cambian una vez al año. Con el defecto de 30 s, cada
    // navegación entre pantallas las vuelve a pedir y en el 4G de James eso son
    // datos gastados sin que él haya pedido nada.
    staleTime: 10 * 60_000,
  });
}
