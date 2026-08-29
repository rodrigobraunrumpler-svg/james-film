import type {
  AdminGalleryDto,
  CategoryRefDto,
  GalleryListItemDto,
  MediaConfirmResult,
  PresignItemInput,
  PresignItemResult,
} from '@james-film/contracts';
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

  actualizar: (id: string, datos: DatosGaleria) =>
    api.patch<AdminGalleryDto>(`/admin/galleries/${id}`, datos),

  /**
   * Idempotente y con HEAD: lo que llegó entero pasa a READY sin volver a subir
   * un byte, y lo que no, a FAILED con el motivo que la API ya redacta.
   */
  confirmar: (mediaId: string) => api.post<MediaConfirmResult>(`/admin/media/${mediaId}/confirm`),
};

export interface DatosGaleria {
  title?: string;
  description?: string | null;
  categoryId?: string;
  eventDate?: string | null;
  location?: string | null;
}

/**
 * Las opciones del selector de categoría. Vive en esta feature y no en una
 * propia porque ninguna feature importa de otra: hasta que Configuración las
 * edite (fase 4), el editor de galería es su único consumidor.
 */
export const categorias = {
  listar: (opts?: RequestOptions) => api.get<CategoryRefDto[]>('/admin/categories', opts),
};

export const medios = {
  /**
   * La API acepta un lote, pero la cola firma de UNO EN UNO a propósito: la
   * preparación (decodificar el vídeo) va en serie, así que esperar a tener los
   * ocho preparados para firmarlos juntos retrasaría la primera subida hasta
   * después del último decode. Además es el MISMO camino que la re-firma del
   * reintento — un solo código, no dos.
   */
  firmar: (galleryId: string, item: PresignItemInput) =>
    api.post<PresignItemResult[]>(`/admin/galleries/${galleryId}/media/presign`, {
      items: [item],
    }),

  confirmar: (mediaId: string) => api.post<MediaConfirmResult>(`/admin/media/${mediaId}/confirm`),

  /** Soft delete. Cancelar sin esto deja una tarjeta muerta hasta el cron. */
  borrar: (mediaId: string) => api.delete<void>(`/admin/media/${mediaId}`),
};
