import type { AdminCategoryDto } from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export interface DatosCategoria {
  name?: string;
  slug?: string;
  tagline?: string | null;
  description?: string | null;
  coverKey?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  isActive?: boolean;
}

export const categorias = {
  listar: (opts?: RequestOptions) => api.get<AdminCategoryDto[]>('/admin/categories', opts),

  crear: (datos: DatosCategoria) => api.post<AdminCategoryDto>('/admin/categories', datos),

  actualizar: (id: string, datos: DatosCategoria) =>
    api.patch<AdminCategoryDto>(`/admin/categories/${id}`, datos),

  borrar: (id: string) => api.delete<void>(`/admin/categories/${id}`),

  /** TODOS los ids: se numera 0..n-1 solo lo que llega. */
  reordenar: (ids: string[]) => api.patch<AdminCategoryDto[]>('/admin/categories/reorder', { ids }),
};
