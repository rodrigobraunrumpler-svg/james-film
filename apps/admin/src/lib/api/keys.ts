/**
 * Claves jerárquicas. Con literales dispersos, `invalidateQueries(['galleries'])`
 * acierta o falla según cómo se escribió cada `useQuery`; con la factoría,
 * invalidar por prefijo es exacto.
 *
 * El objeto de filtros que entra en `list()` es EXACTAMENTE el que gestiona nuqs:
 * una fuente para la URL y para la caché, así no se desincronizan nunca.
 */
export const keys = {
  galleries: {
    all: ['galleries'] as const,
    lists: () => [...keys.galleries.all, 'list'] as const,
    list: (filtros: object) => [...keys.galleries.lists(), filtros] as const,
    // Fuera de `lists()`: los recuentos NO dependen del filtro, y colgarlos ahí
    // los invalidaría en cada cambio de pestaña sin que hayan cambiado.
    counts: () => [...keys.galleries.all, 'counts'] as const,
    detail: (id: string) => [...keys.galleries.all, 'detail', id] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => [...keys.categories.all, 'list'] as const,
  },
  packages: {
    all: ['packages'] as const,
    list: () => [...keys.packages.all, 'list'] as const,
  },
  testimonials: {
    all: ['testimonials'] as const,
    list: (filtros: object = {}) => [...keys.testimonials.all, 'list', filtros] as const,
  },
  settings: {
    all: ['settings'] as const,
    detail: () => [...keys.settings.all, 'detail'] as const,
  },
  storage: {
    usage: ['storage', 'usage'] as const,
  },
  availability: {
    all: ['availability'] as const,
    // El rango es parte de la clave: cada mes tiene su entrada y volver a uno
    // ya visto se pinta desde caché sin ir a la red.
    range: (from: string, to: string) => [...keys.availability.all, 'range', from, to] as const,
    summary: () => [...keys.availability.all, 'summary'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    resumen: () => [...keys.dashboard.all, 'resumen'] as const,
  },
  search: {
    all: ['search'] as const,
    // El término es parte de la clave: así cada búsqueda tiene su entrada y
    // volver a escribir algo ya buscado sale de caché sin ir a la red.
    query: (q: string) => [...keys.search.all, q] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
} as const;
