'use client';

import { useQueries } from '@tanstack/react-query';
import type {
  AdminCategoryDto,
  AdminPackageDto,
  AdminTestimonialDto,
  GalleryCountsDto,
} from '@james-film/contracts';
import { api } from '@/lib/api/http';
import { keys } from '@/lib/api/keys';
import { useMontado } from '@/lib/use-montado';

export interface RecuentosMenu {
  galerias?: number;
  categorias?: number;
  paquetes?: number;
  testimonios?: number;
}

/**
 * Los números que van junto a cada sección del menú: se sabe qué hay dentro
 * ANTES de entrar, que es la mitad de no perderse.
 *
 * Reutiliza LAS MISMAS claves de caché que las pantallas, no unas propias. Con
 * claves nuevas serían cuatro peticiones más por navegación y, peor, dos
 * verdades: el menú diría «Paquetes 3» mientras la pantalla ya enseña cuatro.
 * Así el contador y la lista salen del mismo dato o de ninguno.
 *
 * En `lib` porque lo usa el sidebar, que es compartido: ninguna feature importa
 * de otra.
 *
 * Y ninguna arranca hasta haber MONTADO: el servidor no puede saber estos
 * números, así que su HTML sale sin ellos. Que lleguen antes de que React
 * hidrate esta parte del árbol es un error de hidratación —React descarta el
 * árbol entero— y no es hipotético: pasó en las pestañas de Galerías, que
 * comparten la primera de estas cuatro claves.
 */
export function useRecuentosMenu(): RecuentosMenu {
  const montado = useMontado();

  const [galerias, categorias, paquetes, testimonios] = useQueries({
    queries: [
      {
        queryKey: keys.galleries.counts(),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.get<GalleryCountsDto>('/admin/galleries/counts', { signal }),
        staleTime: 60_000,
        enabled: montado,
      },
      {
        queryKey: keys.categories.list(),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.get<AdminCategoryDto[]>('/admin/categories', { signal }),
        staleTime: 10 * 60_000,
        enabled: montado,
      },
      {
        queryKey: keys.packages.list(),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.get<AdminPackageDto[]>('/admin/packages', { signal }),
        staleTime: 10 * 60_000,
        enabled: montado,
      },
      {
        queryKey: keys.testimonials.list(),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          api.get<AdminTestimonialDto[]>('/admin/testimonials', { signal }),
        staleTime: 5 * 60_000,
        enabled: montado,
      },
    ],
  });

  /**
   * Y `undefined` también hasta MONTAR, no solo mientras carga.
   *
   * `enabled` corta la petición pero no la lectura de caché, así que en una
   * navegación con el dato ya traído este menú pintaría en el primer render un
   * número que el HTML del servidor no tenía. Es el mismo fallo que tumbaba las
   * pestañas de Galerías, y aquí es más fácil que pase porque el sidebar es
   * quien calienta esa caché.
   */
  if (!montado) return {};

  // `undefined` mientras carga, nunca 0: un cero es un dato, y aquí sería
  // mentira — el menú diría «Testimonios 0» con siete dentro.
  return {
    galerias: galerias.data?.data.todas,
    categorias: categorias.data?.data.length,
    paquetes: paquetes.data?.data.length,
    testimonios: testimonios.data?.data.length,
  };
}
