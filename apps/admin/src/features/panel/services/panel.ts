import type { DashboardDto } from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export const panel = {
  /** Todo lo que pinta la pantalla, en una sola petición. */
  resumen: (opts?: RequestOptions) => api.get<DashboardDto>('/admin/dashboard', opts),
};
