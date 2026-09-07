import type {
  AdminCategoryDto,
  CategoryClickShareDto,
  CategoryDto,
} from '@james-film/contracts';
import type { StorageService } from '../../storage/storage.service.js';
import { claveDePortada } from '../galleries/galleries.mapper.js';

/**
 * `select` explícito: lo que no está aquí NUNCA sale de la base. Y como el
 * mapper devuelve el DTO anotado, olvidar un campo no compila.
 */
export const SELECT_CATEGORIA = {
  id: true,
  slug: true,
  name: true,
  tagline: true,
  description: true,
  coverKey: true,
} as const;

export const SELECT_CATEGORIA_ADMIN = {
  ...SELECT_CATEGORIA,
  isActive: true,
  order: true,
  metaTitle: true,
  metaDescription: true,
} as const;

interface FilaCategoria {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  coverKey: string | null;
}

/** Lo justo de cada galería reciente para derivar su portada. */
export interface FilaMedioPortada {
  isFeatured: boolean;
  posterKey: string | null;
  storageKey: string;
  type: 'REEL' | 'AFTERMOVIE' | 'PHOTO';
}

interface FilaCategoriaAdmin extends FilaCategoria {
  isActive: boolean;
  order: number;
  metaTitle: string | null;
  metaDescription: string | null;
  _count: { galleries: number; packages: number };
  galleries: { media: FilaMedioPortada[] }[];
}

export function mapCategoria(c: FilaCategoria, storage: StorageService): CategoryDto {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    description: c.description,
    // Solo StorageService conoce CDN_BASE_URL; el servicio no la lee.
    coverUrl: c.coverKey ? storage.getPublicUrl(c.coverKey) : null,
  };
}

export function mapCategoriaAdmin(
  c: FilaCategoriaAdmin,
  storage: StorageService,
  clickMix: CategoryClickShareDto[] = [],
): AdminCategoryDto {
  return {
    ...mapCategoria(c, storage),
    isActive: c.isActive,
    order: c.order,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    galleryCount: c._count.galleries,
    packageCount: c._count.packages,
    // Solo las que tienen portada: un hueco vacío en la tira se lee como un
    // fallo de carga, y una galería sin medios todavía no enseña nada.
    recentCoverUrls: c.galleries
      .map((g) => claveDePortada(g.media))
      .filter((k): k is string => k !== null)
      .map((k) => storage.getPublicUrl(k)),
    clickMix,
    clickTotal: clickMix.reduce((suma, t) => suma + t.count, 0),
  };
}
