import type { AdminGalleryDto, GalleryListItemDto } from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export interface FiltrosGalerias {
  page: number;
  pageSize: number;
}

/**
 * Las llamadas viven aquí, nunca en un componente. Y van al propio origen: la
 * pasarela pone el Bearer en el servidor.
 */
export const galerias = {
  listar: (filtros: FiltrosGalerias, opts?: RequestOptions) =>
    api.get<GalleryListItemDto[]>('/admin/galleries', { ...opts, query: { ...filtros } }),

  porId: (id: string, opts?: RequestOptions) =>
    api.get<AdminGalleryDto>(`/admin/galleries/${id}`, opts),

  crear: (datos: { title: string; categoryId: string }) =>
    api.post<AdminGalleryDto>('/admin/galleries', datos),
};
