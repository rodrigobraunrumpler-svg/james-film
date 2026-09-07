import type {
  AdminDifferentiatorDto,
  AdminSocialLinkDto,
  SiteSettingsDto,
} from '@james-film/contracts';
import { api, type RequestOptions } from '@/lib/api/http';

export type DatosAjustes = Partial<
  Record<
    | 'brandName'
    | 'role'
    | 'tagline'
    | 'slogan'
    | 'aboutText'
    | 'photoKey'
    | 'logoKey'
    | 'signatureKey'
    | 'whatsappNumber'
    | 'whatsappDisplay'
    | 'whatsappMessage'
    | 'ctaText'
    | 'email'
    | 'heroMediaKey'
    | 'heroPosterKey'
    | 'footerTagline'
    | 'metaTitle'
    | 'metaDescription'
    | 'ogImageKey',
    string | null
  >
>;

export const ajustes = {
  leer: (opts?: RequestOptions) => api.get<SiteSettingsDto>('/admin/settings', opts),
  actualizar: (datos: DatosAjustes) => api.patch<SiteSettingsDto>('/admin/settings', datos),
};

export interface DatosDiferenciador {
  title?: string;
  subtitle?: string | null;
  icon?: string;
  isActive?: boolean;
}

export const diferenciadores = {
  listar: (opts?: RequestOptions) =>
    api.get<AdminDifferentiatorDto[]>('/admin/differentiators', opts),
  crear: (datos: DatosDiferenciador) =>
    api.post<AdminDifferentiatorDto>('/admin/differentiators', datos),
  actualizar: (id: string, datos: DatosDiferenciador) =>
    api.patch<AdminDifferentiatorDto>(`/admin/differentiators/${id}`, datos),
  borrar: (id: string) => api.delete<void>(`/admin/differentiators/${id}`),
  reordenar: (ids: string[]) =>
    api.patch<AdminDifferentiatorDto[]>('/admin/differentiators/reorder', { ids }),
};

export interface DatosRed {
  platform?: string;
  handle?: string;
  url?: string;
  icon?: string | null;
  isActive?: boolean;
}

export const redes = {
  listar: (opts?: RequestOptions) => api.get<AdminSocialLinkDto[]>('/admin/social-links', opts),
  crear: (datos: DatosRed) => api.post<AdminSocialLinkDto>('/admin/social-links', datos),
  actualizar: (id: string, datos: DatosRed) =>
    api.patch<AdminSocialLinkDto>(`/admin/social-links/${id}`, datos),
  borrar: (id: string) => api.delete<void>(`/admin/social-links/${id}`),
  reordenar: (ids: string[]) =>
    api.patch<AdminSocialLinkDto[]>('/admin/social-links/reorder', { ids }),
};
