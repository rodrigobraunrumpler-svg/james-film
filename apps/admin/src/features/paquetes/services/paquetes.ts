import type { AdminPackageDto } from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export interface DatosItem {
  id?: string;
  text: string;
  included?: boolean;
}

export interface DatosPaquete {
  name?: string;
  slug?: string;
  subtitle?: string | null;
  /** CÉNTIMOS. La conversión desde soles vive en `lib/format`. */
  priceAmount?: number | null;
  priceNote?: string | null;
  idealFor?: string | null;
  icon?: string | null;
  imageKey?: string | null;
  accentColor?: string | null;
  badgeText?: string | null;
  whatsappMessage?: string | null;
  isActive?: boolean;
  items?: DatosItem[];
  categoryIds?: string[];
}

export const paquetes = {
  listar: (opts?: RequestOptions) => api.get<AdminPackageDto[]>('/admin/packages', opts),

  crear: (datos: DatosPaquete) => api.post<AdminPackageDto>('/admin/packages', datos),

  actualizar: (id: string, datos: DatosPaquete) =>
    api.patch<AdminPackageDto>(`/admin/packages/${id}`, datos),

  destacar: (id: string) => api.patch<AdminPackageDto>(`/admin/packages/${id}/highlight`),

  borrar: (id: string) => api.delete<void>(`/admin/packages/${id}`),

  reordenar: (ids: string[]) => api.patch<AdminPackageDto[]>('/admin/packages/reorder', { ids }),
};

export const iconos = {
  listar: (opts?: RequestOptions) => api.get<string[]>('/admin/icons', opts),
};
