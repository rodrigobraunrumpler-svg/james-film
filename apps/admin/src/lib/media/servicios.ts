import type {
  AdminMediaDto,
  MediaConfirmResult,
  PresignItemInput,
  PresignItemResult,
  PresignUploadInput,
  PresignUploadResult,
} from '@james-film/contracts';
import { api } from '@/lib/api/http';

/**
 * Las llamadas del dominio «subir archivos». Viven en `lib` y no en la feature
 * de galerías porque la cola las necesita, y **`lib` no puede importar de una
 * feature**: sería la frontera al revés.
 */
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

  /** Lo ÚNICO editable de un medio subido: el resto lo determina el archivo. */
  actualizar: (mediaId: string, datos: { alt?: string | null; caption?: string | null }) =>
    api.patch<AdminMediaDto>(`/admin/media/${mediaId}`, datos),

  /** Soft delete. Cancelar sin esto deja una tarjeta muerta hasta el cron. */
  borrar: (mediaId: string) => api.delete<void>(`/admin/media/${mediaId}`),
};

/**
 * Las nueve claves `*Key` que no son filas `Media`. No crea nada: la clave se
 * guarda cuando el `PATCH` de la entidad la incluye.
 */
export const subidas = {
  firmar: (datos: PresignUploadInput) =>
    api.post<PresignUploadResult>('/admin/uploads/presign', datos),
};
