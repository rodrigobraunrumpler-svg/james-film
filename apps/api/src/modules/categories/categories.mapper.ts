import type { AdminCategoryDto, CategoryDto } from '@james-film/contracts';
import type { StorageService } from '../../storage/storage.service.js';

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

interface FilaCategoriaAdmin extends FilaCategoria {
  isActive: boolean;
  order: number;
  metaTitle: string | null;
  metaDescription: string | null;
  _count: { galleries: number; packages: number };
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
): AdminCategoryDto {
  return {
    ...mapCategoria(c, storage),
    isActive: c.isActive,
    order: c.order,
    metaTitle: c.metaTitle,
    metaDescription: c.metaDescription,
    galleryCount: c._count.galleries,
    packageCount: c._count.packages,
  };
}
