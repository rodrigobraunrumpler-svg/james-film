import type { DashboardDto } from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export const panel = {
  /** Todo lo que pinta la pantalla, en una sola petición. */
  resumen: (opts?: RequestOptions) => api.get<DashboardDto>('/admin/dashboard', opts),

  /**
   * Se salta el debounce de 60 s de la API a propósito: si James pulsa el
   * botón es que ya terminó de editar, y esperar un minuto más le haría dudar
   * de si funcionó.
   */
  publicar: () => api.post<{ solicitado: true }>('/admin/deploy'),
};
