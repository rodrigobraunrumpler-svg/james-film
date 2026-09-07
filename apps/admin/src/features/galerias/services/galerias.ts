import type {
  AdminGalleryDto,
  CategoryRefDto,
  AdminGalleryListItemDto,
  GalleryCountsDto,
  MediaConfirmResult,
} from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

/** La misma lista cerrada que valida `?estado=` en la API. Una sola fuente. */
export const ESTADOS_GALERIA = ['todas', 'publicadas', 'borradores'] as const;
export type EstadoGaleria = (typeof ESTADOS_GALERIA)[number];

export interface FiltrosGalerias {
  estado: EstadoGaleria;
  /** Búsqueda por título. Cadena vacía = sin filtro; la API la recorta igual. */
  q: string;
  page: number;
  pageSize: number;
}

/**
 * Las llamadas viven aquí, nunca en un componente. Y van al propio origen: la
 * pasarela pone el Bearer en el servidor.
 */
export const galerias = {
  listar: (filtros: FiltrosGalerias, opts?: RequestOptions) =>
    api.get<AdminGalleryListItemDto[]>('/admin/galleries', { ...opts, query: { ...filtros } }),

  /** Los tres números de las pestañas. No dependen del filtro: caché propia. */
  contar: (opts?: RequestOptions) => api.get<GalleryCountsDto>('/admin/galleries/counts', opts),

  porId: (id: string, opts?: RequestOptions) =>
    api.get<AdminGalleryDto>(`/admin/galleries/${id}`, opts),

  crear: (datos: { title: string; categoryId: string }) =>
    api.post<AdminGalleryDto>('/admin/galleries', datos),

  /** Soft delete: los objetos siguen en R2 hasta que el cron los purgue. */
  borrar: (id: string) => api.delete<void>(`/admin/galleries/${id}`),

  /**
   * RETIRAR un medio por solicitud de quien aparece en él.
   *
   * No es el `DELETE` de siempre: aquel deja el archivo servido en el dominio
   * `media.` hasta que el cron lo purgue a los 30 días, y quien pide que quiten
   * su cara no acepta «en 30 días» — ni la Ley 29733, que llama a eso
   * cancelación y oposición. Éste lo borra del bucket ahora, y **no se deshace**.
   */
  retirarMedio: (mediaId: string) => api.post<void>(`/admin/media/${mediaId}/retirar`),

  destacar: (id: string, isFeatured: boolean) =>
    api.patch<AdminGalleryDto>(`/admin/galleries/${id}`, { isFeatured }),

  /**
   * Publicar, y con el consentimiento en el MISMO patch cuando hace falta.
   *
   * La API rechaza `isPublished: true` sin `hasConsent` (422 `CONSENT_REQUIRED`),
   * y acepta los dos a la vez: así la confirmación de la hoja es un solo
   * guardado y no deja a la galería con el permiso marcado pero sin publicar si
   * la segunda petición falla.
   */
  publicar: (id: string, isPublished: boolean, hasConsent?: boolean) =>
    api.patch<AdminGalleryDto>(`/admin/galleries/${id}`, {
      isPublished,
      ...(hasConsent === undefined ? {} : { hasConsent }),
    }),

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

export const orden = {
  /**
   * Se mandan TODOS los ids, PENDING incluidos: `ReorderService` numera 0..n-1
   * solo los que recibe y no toca al resto, así que un medio que se confirme
   * dentro de la ventana del debounce y no vaya en el array conservaría su
   * `order` y quedaría descolocado, sin ningún error.
   */
  reordenarMedios: (galleryId: string, ids: string[]) =>
    api.patch<AdminGalleryDto>(`/admin/galleries/${galleryId}/media/reorder`, { ids }),

  marcarPortada: (galleryId: string, mediaId: string) =>
    api.patch<AdminGalleryDto>(`/admin/galleries/${galleryId}/media/${mediaId}/cover`),
};
