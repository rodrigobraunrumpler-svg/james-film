import type { AdminTestimonialDto } from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export interface DatosTestimonio {
  authorName?: string;
  format?: 'TEXT' | 'SCREENSHOT';
  source?: 'WHATSAPP' | 'INSTAGRAM' | 'TIKTOK' | 'DIRECTO';
  authorHandle?: string | null;
  avatarKey?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  quote?: string | null;
  screenshotKey?: string | null;
  externalUrl?: string | null;
  rating?: number | null;
  galleryId?: string | null;
  hasConsent?: boolean;
  isActive?: boolean;
}

export const testimonios = {
  listar: (opts?: RequestOptions) => api.get<AdminTestimonialDto[]>('/admin/testimonials', opts),

  crear: (datos: DatosTestimonio) => api.post<AdminTestimonialDto>('/admin/testimonials', datos),

  actualizar: (id: string, datos: DatosTestimonio) =>
    api.patch<AdminTestimonialDto>(`/admin/testimonials/${id}`, datos),

  destacar: (id: string) => api.patch<AdminTestimonialDto>(`/admin/testimonials/${id}/feature`),

  borrar: (id: string) => api.delete<void>(`/admin/testimonials/${id}`),

  reordenar: (ids: string[]) =>
    api.patch<AdminTestimonialDto[]>('/admin/testimonials/reorder', { ids }),
};
