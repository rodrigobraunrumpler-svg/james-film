'use client';

import { parseAsStringLiteral, useQueryState } from 'nuqs';

export const PESTANAS = ['identidad', 'contacto', 'diferenciadores', 'hero', 'seo'] as const;
export type Pestana = (typeof PESTANAS)[number];

export const ETIQUETAS: Record<Pestana, string> = {
  identidad: 'Identidad',
  contacto: 'Contacto y redes',
  diferenciadores: 'Diferenciadores',
  hero: 'Hero',
  seo: 'SEO',
};

/** En la URL: recargar no pierde la pestaña y el enlace se puede compartir. */
export function usePestana() {
  const [pestana, setPestana] = useQueryState(
    'pestana',
    parseAsStringLiteral(PESTANAS).withDefault('identidad'),
  );
  return { pestana, setPestana };
}
