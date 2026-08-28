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
    list: (filtros: Record<string, unknown>) => [...keys.galleries.lists(), filtros] as const,
    detail: (id: string) => [...keys.galleries.all, 'detail', id] as const,
  },
  categories: {
    all: ['categories'] as const,
    list: () => [...keys.categories.all, 'list'] as const,
  },
  auth: {
    me: ['auth', 'me'] as const,
  },
} as const;
