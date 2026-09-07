import type {
  AdminDifferentiatorDto,
  AdminSocialLinkDto,
  DifferentiatorDto,
  SiteSettingsDto,
  SocialLinkDto,
} from '@james-film/contracts';
import type { StorageService } from '../../storage/storage.service.js';

export const SELECT_AJUSTES = {
  brandName: true,
  role: true,
  tagline: true,
  slogan: true,
  aboutText: true,
  photoKey: true,
  logoKey: true,
  signatureKey: true,
  whatsappNumber: true,
  whatsappDisplay: true,
  whatsappMessage: true,
  ctaText: true,
  email: true,
  heroMediaKey: true,
  heroPosterKey: true,
  footerTagline: true,
  metaTitle: true,
  metaDescription: true,
  ogImageKey: true,
} as const;

export const SELECT_DIFERENCIADOR = {
  id: true,
  title: true,
  subtitle: true,
  icon: true,
  isActive: true,
  order: true,
} as const;

export const SELECT_RED = {
  id: true,
  platform: true,
  handle: true,
  url: true,
  icon: true,
  isActive: true,
  order: true,
} as const;

type FilaAjustes = { [K in keyof typeof SELECT_AJUSTES]: unknown } & {
  brandName: string;
  role: string | null;
  tagline: string | null;
  slogan: string | null;
  aboutText: string | null;
  photoKey: string | null;
  logoKey: string | null;
  signatureKey: string | null;
  whatsappNumber: string | null;
  whatsappDisplay: string | null;
  whatsappMessage: string | null;
  ctaText: string | null;
  email: string | null;
  heroMediaKey: string | null;
  heroPosterKey: string | null;
  footerTagline: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageKey: string | null;
};

interface FilaDiferenciador {
  id: string;
  title: string;
  subtitle: string | null;
  icon: string;
  isActive: boolean;
  order: number;
}

interface FilaRed {
  id: string;
  platform: string;
  handle: string;
  url: string;
  icon: string | null;
  isActive: boolean;
  order: number;
}

export function mapAjustes(a: FilaAjustes, storage: StorageService): SiteSettingsDto {
  const url = (clave: string | null): string | null => (clave ? storage.getPublicUrl(clave) : null);
  return {
    brandName: a.brandName,
    role: a.role,
    tagline: a.tagline,
    slogan: a.slogan,
    aboutText: a.aboutText,
    photoUrl: url(a.photoKey),
    logoUrl: url(a.logoKey),
    signatureUrl: url(a.signatureKey),
    whatsappNumber: a.whatsappNumber,
    whatsappDisplay: a.whatsappDisplay,
    whatsappMessage: a.whatsappMessage,
    ctaText: a.ctaText,
    email: a.email,
    heroMediaUrl: url(a.heroMediaKey),
    heroPosterUrl: url(a.heroPosterKey),
    footerTagline: a.footerTagline,
    metaTitle: a.metaTitle,
    metaDescription: a.metaDescription,
    ogImageUrl: url(a.ogImageKey),
  };
}

export const mapDiferenciador = (d: FilaDiferenciador): DifferentiatorDto => ({
  id: d.id,
  title: d.title,
  subtitle: d.subtitle,
  icon: d.icon,
});

export const mapDiferenciadorAdmin = (d: FilaDiferenciador): AdminDifferentiatorDto => ({
  ...mapDiferenciador(d),
  isActive: d.isActive,
  order: d.order,
});

export const mapRed = (r: FilaRed): SocialLinkDto => ({
  id: r.id,
  platform: r.platform,
  handle: r.handle,
  url: r.url,
  icon: r.icon,
});

export const mapRedAdmin = (r: FilaRed): AdminSocialLinkDto => ({
  ...mapRed(r),
  isActive: r.isActive,
  order: r.order,
});
