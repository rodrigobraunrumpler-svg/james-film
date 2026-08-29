'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

export const ESTADOS = ['todos', 'publicados', 'borradores', 'sin-consentimiento'] as const;
export type EstadoFiltro = (typeof ESTADOS)[number];

/** La URL es la fuente: recargar no pierde el filtro y el enlace se comparte. */
export function useFiltroTestimonios() {
  const [estado, setEstado] = useQueryState(
    'estado',
    parseAsStringLiteral(ESTADOS).withDefault('todos'),
  );
  return { estado, setEstado };
}
